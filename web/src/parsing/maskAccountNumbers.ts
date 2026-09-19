const ACCOUNT_KEYWORD = /\b(account\s*no\.?|acc\.?\s*no\.?|a\/c\s*no\.?|no\.?\s*akaun|akaun)\b/i;
const ACCOUNT_NUMBER = /\b[\d\s-]{8,20}\d\b/;

function maskDigits(match: string): string {
  const digits = match.replace(/\D/g, '');
  if (digits.length < 8) return match;
  const last4 = digits.slice(-4);
  return `${'*'.repeat(digits.length - 4)}${last4}`;
}

/**
 * Finds account numbers next to an "Account No" / "No Akaun" style label and
 * masks all but the last 4 digits, both in the returned text and as a
 * separate list (e.g. for a "masked fields" indicator in the UI). Only acts
 * near an explicit label so reference numbers/amounts are never masked by
 * mistake.
 */
export function maskAccountNumbers(text: string): { maskedText: string; masked: string[] } {
  const masked: string[] = [];
  const lines = text.split(/\r?\n/).map((line) => {
    if (!ACCOUNT_KEYWORD.test(line)) return line;
    return line.replace(ACCOUNT_NUMBER, (m) => {
      const result = maskDigits(m);
      if (result !== m) masked.push(result);
      return result;
    });
  });

  return { maskedText: lines.join('\n'), masked };
}
