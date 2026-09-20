import type { ParsedField } from '../types';

const REF_KEYWORD =
  /\b(reference\s*no\.?|ref\.?\s*no\.?|reference|ref\.?|transaction\s*id|trans\.?\s*no\.?|receipt\s*no\.?|no\.?\s*rujukan|rujukan)\s*[:\-]?\s*/i;

// Reference numbers are alphanumeric, often with dashes/slashes, long enough
// that we won't mistake a short quantity for one, and - importantly -
// contain at least one digit, so a nearby person's name (e.g. a
// "Recipient reference" field showing the payer's name) is never mistaken
// for a transaction reference just because it also matched the "reference"
// keyword.
const REF_VALUE_G = /[A-Z0-9][A-Z0-9\-/]{4,}/gi;

// OCR sometimes drops spaces around a date (e.g. "31 Jul 2026" -> "31Jul2026"),
// which would otherwise look exactly like a plausible reference code - skip
// anything containing a month abbreviation so a mangled date is never
// mistaken for a transaction reference.
const MONTH_ABBREVIATION = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;

function findRefValue(line: string): string | null {
  REF_VALUE_G.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_VALUE_G.exec(line))) {
    if (/\d/.test(m[0]) && !MONTH_ABBREVIATION.test(m[0])) return m[0];
  }
  return null;
}

const LOOKAHEAD_LINES = 3;

export function parseReferenceNo(text: string): ParsedField<string> {
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const keywordMatch = lines[i].match(REF_KEYWORD);
    if (!keywordMatch) continue;

    const rest = lines[i].slice((keywordMatch.index ?? 0) + keywordMatch[0].length);
    const sameLineValue = findRefValue(rest);
    if (sameLineValue) {
      return { value: sameLineValue, confidence: 95, raw: keywordMatch[0] + sameLineValue };
    }

    // The value isn't always on the very next line: some receipts put
    // another field's text between a label and its value (e.g. a date/time
    // shown beside "Reference ID", with the actual reference number below
    // both). Search a small window of following lines rather than just one.
    for (let j = i + 1; j < Math.min(lines.length, i + 1 + LOOKAHEAD_LINES); j++) {
      const candidate = findRefValue(lines[j]);
      if (candidate) {
        return { value: candidate, confidence: 88, raw: `${keywordMatch[0]} / ${candidate}` };
      }
    }
  }

  return { value: null, confidence: 0 };
}
