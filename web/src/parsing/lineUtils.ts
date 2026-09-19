/**
 * Finds the next non-blank line after `fromIndex`, skipping blank lines.
 * OCR output frequently inserts blank lines between text fragments
 * (paragraph/block separators, or Tesseract's SPARSE_TEXT mode separating
 * every detected fragment), so a naive `lines[i + 1]` lookup for a
 * "label above, value below" layout can land on an empty line instead of
 * the actual value. Capped at a small lookahead so we don't wander into
 * unrelated content further down the slip.
 */
export function nextNonEmptyLine(lines: string[], fromIndex: number, maxLookahead = 3): string | null {
  for (let i = fromIndex; i < Math.min(lines.length, fromIndex + maxLookahead); i++) {
    const trimmed = lines[i]?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
