import type { ParsedField } from '../types';

const REF_KEYWORD =
  /\b(reference\s*no\.?|ref\.?\s*no\.?|reference|ref\.?|transaction\s*id|trans\.?\s*no\.?|receipt\s*no\.?|no\.?\s*rujukan|rujukan)\s*[:\-]?\s*/i;

// Reference numbers are alphanumeric, often with dashes/slashes, and long
// enough that we won't mistake a short quantity or page number for one.
const REF_VALUE = /[A-Z0-9][A-Z0-9\-/]{4,}/i;

export function parseReferenceNo(text: string): ParsedField<string> {
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const keywordMatch = lines[i].match(REF_KEYWORD);
    if (!keywordMatch) continue;

    const rest = lines[i].slice((keywordMatch.index ?? 0) + keywordMatch[0].length);
    const sameLineValue = rest.match(REF_VALUE);
    if (sameLineValue) {
      return { value: sameLineValue[0], confidence: 95, raw: keywordMatch[0] + sameLineValue[0] };
    }

    // Mobile "share receipt" screens often put the label and its value on
    // separate lines (label, then a bold value below it) instead of
    // "Label: value" on one line - check the next line too.
    const nextLine = lines[i + 1]?.trim();
    if (nextLine) {
      const nextLineValue = nextLine.match(REF_VALUE);
      if (nextLineValue) {
        return { value: nextLineValue[0], confidence: 90, raw: `${keywordMatch[0]} / ${nextLineValue[0]}` };
      }
    }
  }

  return { value: null, confidence: 0 };
}
