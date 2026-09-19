import type { ParsedField } from '../types';
import { nextNonEmptyLine } from './lineUtils';

const AMOUNT_KEYWORD = /\b(amount|amaun|total|jumlah)\b/i;
const CURRENCY_PREFIX_SRC = '(RM|MYR|\\$)';

// Digits plus their common OCR misreads (O/o -> 0, l/I -> 1, S/s -> 5, B/b -> 8),
// separated by thousand/decimal punctuation or stray whitespace from the scan.
const NUMERIC_TOKEN_SRC = '[0-9OolISB](?:[0-9OolISB,.\\s]{0,17}[0-9OolISB])?';

// Currency prefix is optional here (labels like "Amount"/"Total" already tell
// us this is a money field even without RM/MYR/$ in front of the number).
const MONEY_TOKEN_G = new RegExp(`${CURRENCY_PREFIX_SRC}?\\s*(${NUMERIC_TOKEN_SRC})`, 'gi');
// Currency prefix is mandatory for the no-keyword fallback, so we never treat
// a bare/unlabeled number elsewhere on the slip as the amount.
const MONEY_TOKEN_WITH_CURRENCY_G = new RegExp(`${CURRENCY_PREFIX_SRC}\\s*(${NUMERIC_TOKEN_SRC})`, 'gi');

function cleanNumericToken(raw: string): { value: number; hadOcrFix: boolean } | null {
  const noSpace = raw.replace(/\s+/g, '');
  const hadOcrFix = /[OolISB]/.test(noSpace);
  const digits = noSpace
    .replace(/[Oo]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');

  const decimalMatch = digits.match(/[.,](\d{2})$/);
  let numberStr: string;
  if (decimalMatch) {
    const integerPart = digits.slice(0, digits.length - 3).replace(/[.,]/g, '');
    numberStr = `${integerPart || '0'}.${decimalMatch[1]}`;
  } else {
    numberStr = digits.replace(/[.,]/g, '');
  }

  const value = Number(numberStr);
  if (!Number.isFinite(value)) return null;
  return { value, hadOcrFix };
}

function currencyFromPrefix(prefix?: string): string {
  if (!prefix) return 'MYR';
  const p = prefix.toUpperCase();
  if (p === 'RM' || p === 'MYR') return 'MYR';
  return 'MYR'; // Assumption: bank-in slips in this app are Malaysian; a bare "$" is treated as MYR too.
}

/** Finds the first match whose numeric group contains at least one real digit,
 * so a stray confusable letter inside a label word (e.g. the "O"/"L" in
 * "TOTAL") is never mistaken for the amount itself. */
function firstRealMatch(regex: RegExp, text: string): RegExpExecArray | null {
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (/\d/.test(m[2])) return m;
  }
  return null;
}

export function parseAmount(text: string): { amount: ParsedField<number>; currency: ParsedField<string> } {
  const lines = text.split(/\r?\n/);

  let bestMatch: { raw: string; prefix?: string; nearKeyword: boolean } | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (!AMOUNT_KEYWORD.test(lines[i])) continue;

    const afterKeyword = lines[i].slice(lines[i].search(AMOUNT_KEYWORD));
    const sameLineMatch = firstRealMatch(MONEY_TOKEN_G, afterKeyword);
    if (sameLineMatch) {
      bestMatch = { raw: sameLineMatch[2], prefix: sameLineMatch[1], nearKeyword: true };
      break;
    }

    // Some receipts put the label and value on separate lines - check the next non-blank line too.
    const nextLine = nextNonEmptyLine(lines, i + 1);
    if (nextLine) {
      const nextLineMatch = firstRealMatch(MONEY_TOKEN_G, nextLine);
      if (nextLineMatch) {
        bestMatch = { raw: nextLineMatch[2], prefix: nextLineMatch[1], nearKeyword: true };
        break;
      }
    }
  }

  if (!bestMatch) {
    // Fall back to any currency-prefixed number in the whole text; never guess
    // a bare number as the amount without a keyword or currency symbol.
    const m = firstRealMatch(MONEY_TOKEN_WITH_CURRENCY_G, text);
    if (m) {
      bestMatch = { raw: m[2], prefix: m[1], nearKeyword: false };
    }
  }

  if (!bestMatch) {
    return {
      amount: { value: null, confidence: 0 },
      currency: { value: null, confidence: 0 },
    };
  }

  const cleaned = cleanNumericToken(bestMatch.raw);
  if (!cleaned) {
    return {
      amount: { value: null, confidence: 0 },
      currency: { value: null, confidence: 0 },
    };
  }

  let confidence = bestMatch.nearKeyword ? 95 : 75;
  if (cleaned.hadOcrFix) confidence -= 10;
  if (!bestMatch.prefix) confidence -= 15;

  const currencyConfidence = bestMatch.prefix ? 95 : 60;

  return {
    amount: {
      value: Math.round(cleaned.value * 100) / 100,
      confidence: Math.max(0, confidence),
      raw: bestMatch.raw.trim(),
    },
    currency: {
      value: currencyFromPrefix(bestMatch.prefix),
      confidence: currencyConfidence,
      raw: bestMatch.prefix,
    },
  };
}
