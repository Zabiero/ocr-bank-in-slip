import type { ParsedField } from '../types';

const REF_KEYWORD =
  /\b(reference\s*no\.?|ref\.?\s*no\.?|reference|ref\.?|transaction\s*id|trans\.?\s*no\.?|receipt\s*no\.?|no\.?\s*rujukan|rujukan)\s*[:\-]?\s*/i;

// Reference numbers are alphanumeric, often with dashes/slashes, and long
// enough that we won't mistake a short quantity or page number for one.
const REF_VALUE = /[A-Z0-9][A-Z0-9\-/]{4,}/i;

export function parseReferenceNo(text: string): ParsedField<string> {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const keywordMatch = line.match(REF_KEYWORD);
    if (keywordMatch) {
      const rest = line.slice((keywordMatch.index ?? 0) + keywordMatch[0].length);
      const valueMatch = rest.match(REF_VALUE);
      if (valueMatch) {
        return { value: valueMatch[0], confidence: 95, raw: keywordMatch[0] + valueMatch[0] };
      }
    }
  }

  return { value: null, confidence: 0 };
}
