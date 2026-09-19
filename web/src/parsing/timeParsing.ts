import type { ParsedField } from '../types';

const TIME_KEYWORD = /\b(time|masa)\b/i;
const TIME_PATTERN = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?\b/;

function format(hour: number, minute: number, second: number, meridiemHint?: string): string | null {
  if (minute > 59 || second > 59) return null;

  let h24 = hour;
  if (meridiemHint) {
    const isPm = meridiemHint.toLowerCase().startsWith('p');
    if (hour === 12) h24 = isPm ? 12 : 0;
    else h24 = isPm ? hour + 12 : hour;
  }
  if (h24 > 23) return null;

  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  const hh = String(h12).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return `${hh}:${mm}:${ss} ${period}`;
}

export function parseTime(text: string): ParsedField<string> {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (TIME_KEYWORD.test(line)) {
      const m = line.match(TIME_PATTERN);
      if (m) {
        const value = format(Number(m[1]), Number(m[2]), Number(m[3] ?? '0'), m[4]);
        if (value) return { value, confidence: 95, raw: m[0] };
      }
    }
  }

  const m = text.match(TIME_PATTERN);
  if (m) {
    const value = format(Number(m[1]), Number(m[2]), Number(m[3] ?? '0'), m[4]);
    if (value) return { value, confidence: 70, raw: m[0] };
  }

  return { value: null, confidence: 0 };
}
