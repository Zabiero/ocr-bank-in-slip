import type { ParsedField } from '../types';

const DATE_KEYWORD = /\b(date|tarikh)\b/i;
const TRANSACTION_DATE_KEYWORD =
  /\b(value|transaction|txn|payment|posting|transfer|effective)\s*date\b|\btarikh\s*(transaksi|bayaran|nilai|pindahan)\b/i;

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
  /** True when day/month were both <= 12, so day-first (Malaysian convention) decided the order. */
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
    // 12 Sep 2026 / 12 September 2026 / 12 Mac 2026 / 12Sep2026 (OCR
    // sometimes drops the spaces entirely around a recognized month name) /
    // 07-Sep-2026 (hyphen-separated, seen on DuitNow transfer receipts)
    regex: new RegExp(`\\b(\\d{1,2})[\\s-]*(${MONTH_NAME_PATTERN})\\.?[\\s-]*(\\d{2,4})\\b`, 'gi'),
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

export function parseDate(text: string): ParsedField<string> {
  const candidates = findAllCandidates(text);
  if (candidates.length === 0) {
    return { value: null, confidence: 0 };
  }

  // Prefer a candidate near a "Date"/"Tarikh" label: on the same line, one
  // of the next few non-blank lines (for receipts that put the label and
  // value on separate lines, possibly with a blank line in between - common
  // in OCR block output), or one of the previous few non-blank lines. A
  // label-left/value-right table read column-by-column can put the value
  // *before* its own label instead of on or after it (confirmed on a real
  // DuitNow receipt: "07-Sep-2026" then "Payment Date").
  const lines = text.split(/\r?\n/);
  const lineSpans: Array<{ start: number; end: number }> = [];
  {
    let cursor = 0;
    for (const line of lines) {
      lineSpans.push({ start: cursor, end: cursor + line.length });
      cursor += line.length + 1;
    }
  }

  const candidateOnLine = (j: number) => {
    const { start, end } = lineSpans[j];
    return candidates.find((c) => c.matchIndex >= start && c.matchIndex < end);
  };

  // Non-blank lines only: Tesseract's SPARSE_TEXT mode puts a blank line
  // after every fragment, so "label, blank, [other field], blank, value" is
  // several raw lines away despite being only a couple of real fragments
  // past the label - counting raw indices instead of real fragments capped
  // out too early on a real receipt (confirmed: a value 2 fragments past
  // its label sat 4 raw lines away and was missed).
  const MAX_LOOKAROUND = 3;
  const candidateNearLabel = (i: number): Candidate | null => {
    const sameLine = candidateOnLine(i);
    if (sameLine) return sameLine;
    for (let j = i + 1, seen = 0; j < lines.length && seen < MAX_LOOKAROUND; j++) {
      if (lines[j].trim() === '') continue;
      seen++;
      const found = candidateOnLine(j);
      if (found) return found;
    }
    for (let j = i - 1, seen = 0; j >= 0 && seen < MAX_LOOKAROUND; j--) {
      if (lines[j].trim() === '') continue;
      seen++;
      const found = candidateOnLine(j);
      if (found) return found;
    }
    return null;
  };

  // Every labelled date on the slip, not just the first - a slip can carry
  // two (e.g. a debit advice's document "Date" plus its "Value Date"), and
  // OCR can misread one but not the other. Confirmed on a real Hong Leong
  // debit advice: in-browser OCR read the header "Date" as 01/08/2026 while
  // "Value Date" right below it read correctly as 01-09-2026; taking the
  // first match returned the wrong one.
  const labelled: Array<{ candidate: Candidate; transactionSpecific: boolean }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!DATE_KEYWORD.test(lines[i])) continue;
    const candidate = candidateNearLabel(i);
    if (candidate) labelled.push({ candidate, transactionSpecific: TRANSACTION_DATE_KEYWORD.test(lines[i]) });
  }

  // A transaction-specific label ("Value Date", "Transaction Date", ...)
  // names the date that actually matters for a payment; a bare "Date" is
  // often just the document's own issue/print date. Prefer the former.
  const preferred = labelled.find((l) => l.transactionSpecific) ?? labelled[0];
  const chosen = preferred?.candidate ?? candidates[0];

  let confidence = preferred ? 95 : 75;
  if (chosen.ambiguous) confidence -= 10;
  // Labelled dates that disagree mean OCR misread at least one of them -
  // the preferred pick is the best guess, but keep it below the review
  // threshold so the conflict gets a human look instead of passing silently.
  const disagreement = labelled.some(
    (l) => format(l.candidate.day, l.candidate.month, l.candidate.year) !== format(chosen.day, chosen.month, chosen.year),
  );
  if (disagreement) confidence = Math.min(confidence, 70);

  return { value: format(chosen.day, chosen.month, chosen.year), confidence, raw: chosen.matchText };
}
