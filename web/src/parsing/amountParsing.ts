import type { ParsedField } from '../types';

const AMOUNT_KEYWORD = /\b(amount|amaun|total|jumlah)\b/i;
const CURRENCY_PREFIX_SRC = '(RM|MYR|\\$)';

// Digits plus their common OCR misreads (O/o -> 0, l/I -> 1, S/s -> 5, B/b -> 8),
// separated by thousand/decimal punctuation or stray whitespace from the
// scan - but never a newline. Tesseract's SPARSE_TEXT output puts blank
// lines between fragments, so allowing \s (which matches newlines) here let
// this greedily absorb the first letter of a completely unrelated line
// right after the amount whenever that letter happened to be one of the
// OCR-misread ones - confirmed on a real slip: "RM18.50" followed by
// "ONEPLUSONENANYANGCOFFEE" on the next line matched as "18.50\n\nO",
// which 'O' -> '0' then turned into 18500 instead of 18.5.
const NUMERIC_TOKEN_SRC = '[0-9OolISB](?:[0-9OolISB,.\\t ]{0,17}[0-9OolISB])?';

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

  // Malaysian amounts always use '.' for decimal (sen) and ',' for thousands
  // grouping - never the other way around - so only a trailing period counts
  // as a decimal point; a trailing comma is always grouping, even one
  // followed by exactly 2 digits (an OCR-truncated 3-digit group, e.g. a
  // dropped last digit of "12,345", reads far more plausibly as 1234 than as
  // 12.34). 1 or 2 digits after the period both count - not just 2 - since
  // OCR dropping a trailing "0" off ".50" produces the equally valid-looking
  // ".5"; requiring exactly 2 made "1000.5" parse as 10005 (the decimal
  // point silently absorbed into the integer part, a 10x-magnitude bug).
  const decimalMatch = digits.match(/\.(\d{1,2})$/);
  let numberStr: string;
  if (decimalMatch) {
    const integerPart = digits.slice(0, digits.length - decimalMatch[0].length).replace(/[.,]/g, '');
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

// How many non-blank lines to search around a label before giving up - not
// raw line indices. Tesseract's SPARSE_TEXT mode puts a blank line after
// every fragment, and some documents (e.g. a fixed-width-font payment
// advice with "Label / : / : / value" alignment padding) put several more
// non-value fragments between a label and its value on top of that -
// confirmed on a real Citi payment advice where "Invoice Amount" and its
// "3,300.00" value were separated by two lone ":" fragments, each on its
// own blank-padded line. Counting only real fragments (not raw line
// position) and continuing past ones with no usable value in them (like a
// lone ":") - rather than stopping at the first non-blank line the way
// nextNonEmptyLine/previousNonEmptyLine do - handles this.
const LOOKAROUND_LINES = 5;

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

    // A label-left/value-right table can be read column-by-column, putting
    // the value on a line *before* its own label - check that first, since
    // it's the pattern actually observed on a real receipt. Currency prefix
    // is required here (unlike the forward search below): a line above is
    // more likely to be unrelated content from a different field (e.g. a
    // reference number), and a bare number there is too easy to mistake for
    // an amount.
    for (let j = i - 1, seen = 0; j >= 0 && seen < LOOKAROUND_LINES; j--) {
      if (lines[j].trim() === '') continue;
      seen++;
      const previousLineMatch = firstRealMatch(MONEY_TOKEN_WITH_CURRENCY_G, lines[j]);
      if (previousLineMatch) {
        bestMatch = { raw: previousLineMatch[2], prefix: previousLineMatch[1], nearKeyword: true };
        break;
      }
    }
    if (bestMatch) break;

    // Some receipts put the label and value on separate lines, sometimes
    // with other non-value fragments (blank padding, a lone ":") between
    // them - search a window of following fragments rather than just one.
    for (let j = i + 1, seen = 0; j < lines.length && seen < LOOKAROUND_LINES; j++) {
      if (lines[j].trim() === '') continue;
      seen++;
      const nextLineMatch = firstRealMatch(MONEY_TOKEN_G, lines[j]);
      if (nextLineMatch) {
        bestMatch = { raw: nextLineMatch[2], prefix: nextLineMatch[1], nearKeyword: true };
        break;
      }
    }
    if (bestMatch) break;
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
