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

/**
 * Finds the previous non-blank line before `fromIndex`. A label-left/
 * value-right table read by Tesseract's SPARSE_TEXT mode is often emitted
 * column-by-column rather than row-by-row, so a value can land on the line
 * immediately *before* its own label instead of on or after it (confirmed
 * on a real DuitNow transfer receipt: "MYR 10,678.00" then "Amount", not
 * the other way around). Capped at a small look-back for the same reason
 * nextNonEmptyLine caps its lookahead - stay near the label, don't wander
 * into an unrelated field further up the slip.
 */
export function previousNonEmptyLine(lines: string[], fromIndex: number, maxLookback = 3): string | null {
  for (let i = fromIndex; i > Math.max(-1, fromIndex - maxLookback); i--) {
    const trimmed = lines[i]?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
