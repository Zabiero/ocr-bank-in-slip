import type { DateAmbiguityMode, ParsedField } from '../types';

const DATE_KEYWORD = /\b(date|tarikh)\b/i;

/** English + Malay month names/abbreviations, for formats like "12 Sep 2026" or "12 Mac 2026". */
const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  januari: 1,
  feb: 2,
  february: 2,
  februari: 2,
  mar: 3,
  march: 3,
  mac: 3,
  apr: 4,
  april: 4,
  may: 5,
  mei: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  julai: 7,
  aug: 8,
  august: 8,
  ogos: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
  disember: 12,
};

const MONTH_NAME_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

interface Candidate {
  day: number;
  month: number;
  year: number;
  /** True when day/month were both <= 12, so the day-first/month-first setting decided the order. */
  ambiguous: boolean;
  matchIndex: number;
  matchText: string;
}

const PATTERNS: Array<{ regex: RegExp; build: (m: RegExpMatchArray) => Omit<Candidate, 'matchIndex' | 'matchText'> | null }> = [
  {
    // ISO: 2026-09-12
    regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    build: (m) => ({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), ambiguous: false }),
  },
  {
    // 12 Sep 2026 / 12 September 2026 / 12 Mac 2026
    regex: new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAME_PATTERN})\\.?\\s+(\\d{2,4})\\b`, 'gi'),
    build: (m) => {
      const month = MONTHS[m[2].toLowerCase()];
      if (!month) return null;
      return { day: Number(m[1]), month, year: normalizeYear(Number(m[3])), ambiguous: false };
    },
  },
  {
    // DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY
    regex: /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g,
    build: (m) => {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const year = normalizeYear(Number(m[3]));
      return resolveDayMonth(a, b, year);
    },
  },
];

function normalizeYear(y: number): number {
  if (y >= 100) return y;
  return y <= 68 ? 2000 + y : 1900 + y;
}

function resolveDayMonth(a: number, b: number, year: number): Omit<Candidate, 'matchIndex' | 'matchText'> | null {
  const aValidDay = a >= 1 && a <= 31;
  const bValidDay = b >= 1 && b <= 31;
  const aValidMonth = a >= 1 && a <= 12;
  const bValidMonth = b >= 1 && b <= 12;

  if (aValidMonth && bValidDay && !bValidMonth) {
    // Only interpretation: a=month, b=day (e.g. 25/03 -> day 25 can't be month)
    return { day: b, month: a, year, ambiguous: false };
  }
  if (bValidMonth && aValidDay && !aValidMonth) {
    return { day: a, month: b, year, ambiguous: false };
  }
  if (aValidMonth && bValidMonth) {
    // Both plausible as day or month -> ambiguous, resolved by setting.
    return { day: a, month: b, year, ambiguous: true };
  }
  if (aValidDay && bValidMonth) {
    return { day: a, month: b, year, ambiguous: false };
  }
  return null;
}

function isValidDate(c: { day: number; month: number; year: number }): boolean {
  if (c.month < 1 || c.month > 12) return false;
  if (c.day < 1 || c.day > 31) return false;
  const daysInMonth = new Date(c.year, c.month, 0).getDate();
  return c.day <= daysInMonth;
}

function findAllCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const { regex, build } of PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text))) {
      const built = build(m);
      if (built && isValidDate(built)) {
        candidates.push({ ...built, matchIndex: m.index, matchText: m[0] });
      }
    }
  }
  return candidates;
}

function format(day: number, month: number, year: number): string {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}-${mm}-${year}`;
}

export function parseDate(text: string, mode: DateAmbiguityMode): ParsedField<string> {
  const candidates = findAllCandidates(text);
  if (candidates.length === 0) {
    return { value: null, confidence: 0 };
  }

  // Prefer a candidate near a "Date"/"Tarikh" label on the same line.
  const lines = text.split(/\r?\n/);
  let lineStart = 0;
  let nearKeyword: Candidate | null = null;
  for (const line of lines) {
    const lineEnd = lineStart + line.length;
    if (DATE_KEYWORD.test(line)) {
      const inLine = candidates.find((c) => c.matchIndex >= lineStart && c.matchIndex < lineEnd);
      if (inLine) {
        nearKeyword = inLine;
        break;
      }
    }
    lineStart = lineEnd + 1;
  }

  const chosen = nearKeyword ?? candidates[0];
  const day = chosen.ambiguous && mode === 'month-first' ? chosen.month : chosen.day;
  const month = chosen.ambiguous && mode === 'month-first' ? chosen.day : chosen.month;

  if (!isValidDate({ day, month, year: chosen.year })) {
    // Swapping for month-first made it invalid (e.g. day > 12); fall back to the only valid order.
    return {
      value: format(chosen.day, chosen.month, chosen.year),
      confidence: nearKeyword ? 90 : 70,
      raw: chosen.matchText,
    };
  }

  let confidence = nearKeyword ? 95 : 75;
  if (chosen.ambiguous) confidence -= 10;

  return { value: format(day, month, chosen.year), confidence, raw: chosen.matchText };
}
