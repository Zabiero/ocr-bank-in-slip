import type { ParsedField } from '../types';

// "reference"/"rujukan"'s leading letter is optional: OCR occasionally drops
// the first character of a text run entirely (confirmed on a real DuitNow
// receipt - "Reference No" read as "eference No", which still has to match
// so the parser doesn't skip past the real field and grab a different one,
// like "Service Reference No", instead). Same idea as this codebase's
// existing handling of AEON's logo dropping its stylized "A".
//
// A clean (not OCR-corrupted) "Service Reference No" must never match at
// all, regardless of which one appears first in the document - two real
// receipts happen to always put the real "Reference No" first, so the
// existing order-based search got the right answer by coincidence, but nothing
// stopped a differently-ordered receipt from matching the decoy instead.
const REF_KEYWORD =
  /\b(?<!service\s)(r?eference\s*no\.?|ref\.?\s*no\.?|r?eference|ref\.?|transaction\s*id|trans\.?\s*no\.?|receipt\s*no\.?|no\.?\s*rujukan|r?ujukan)\s*[:\-]?\s*/i;

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

const LOOKAROUND_LINES = 3;

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
    // both). Search a small window of following lines rather than just one -
    // counting only non-blank lines toward that window, not raw line
    // indices: Tesseract's SPARSE_TEXT mode puts a blank line after every
    // fragment, so "label, blank, date, blank, value" is 4 raw lines away
    // despite being only 2 real fragments past the label. Confirmed on a
    // real Maybank receipt - counting raw lines capped out one line short
    // of the actual value and missed it entirely.
    for (let j = i + 1, seen = 0; j < lines.length && seen < LOOKAROUND_LINES; j++) {
      if (lines[j].trim() === '') continue;
      seen++;
      const candidate = findRefValue(lines[j]);
      if (candidate) {
        return { value: candidate, confidence: 88, raw: `${keywordMatch[0]} / ${candidate}` };
      }
    }

    // A label-left/value-right table can be read column-by-column, putting
    // the value on a line *before* its own label instead of on or after it
    // (confirmed on a real DuitNow receipt, for a different field - the
    // same reading order applies here on some receipts).
    for (let j = i - 1, seen = 0; j >= 0 && seen < LOOKAROUND_LINES; j--) {
      if (lines[j].trim() === '') continue;
      seen++;
      const candidate = findRefValue(lines[j]);
      if (candidate) {
        return { value: candidate, confidence: 85, raw: `${keywordMatch[0]} / ${candidate}` };
      }
    }
  }

  return { value: null, confidence: 0 };
}
