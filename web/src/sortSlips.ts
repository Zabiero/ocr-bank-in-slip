import type { SlipRecord } from './types';

export type SortColumn = 'date' | 'time' | 'amount' | 'referenceNo' | 'bank' | 'status';
export type SortDirection = 'asc' | 'desc';

/** "DD-MM-YYYY" -> a YYYYMMDD number that sorts chronologically. */
function dateSortKey(value: string): number {
  const [day, month, year] = value.split('-').map(Number);
  return year * 10000 + month * 100 + day;
}

/** "hh:mm:ss AM/PM" -> seconds since midnight. */
function timeSortKey(value: string): number {
  const m = value.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let hour = Number(m[1]) % 12;
  if (/pm/i.test(m[4])) hour += 12;
  return hour * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

interface SortKey {
  /** A field that's null/not-found always sorts to the bottom, regardless of direction. */
  isNull: boolean;
  key: number | string;
}

function keyFor(slip: SlipRecord, column: SortColumn): SortKey {
  switch (column) {
    case 'date': {
      const v = slip.parsed.date.value;
      return v ? { isNull: false, key: dateSortKey(v) } : { isNull: true, key: 0 };
    }
    case 'time': {
      const v = slip.parsed.time.value;
      return v ? { isNull: false, key: timeSortKey(v) } : { isNull: true, key: 0 };
    }
    case 'amount': {
      const v = slip.parsed.amount.value;
      return v != null ? { isNull: false, key: v } : { isNull: true, key: 0 };
    }
    case 'referenceNo': {
      const v = slip.parsed.referenceNo.value;
      return v ? { isNull: false, key: v.toLowerCase() } : { isNull: true, key: '' };
    }
    case 'bank': {
      const v = slip.parsed.bank.value;
      return v ? { isNull: false, key: v.toLowerCase() } : { isNull: true, key: '' };
    }
    case 'status':
      return { isNull: false, key: slip.status };
  }
}

/**
 * Sorts a copy of `slips` by the given column/direction. Fields that weren't
 * found (null) always sort to the bottom regardless of direction, rather
 * than clustering at the "start" of a descending sort - a missing value
 * isn't a low value, it's not a value at all.
 */
export function sortSlips(slips: SlipRecord[], column: SortColumn, direction: SortDirection): SlipRecord[] {
  const dirMul = direction === 'asc' ? 1 : -1;

  return [...slips].sort((a, b) => {
    const ka = keyFor(a, column);
    const kb = keyFor(b, column);
    if (ka.isNull !== kb.isNull) return ka.isNull ? 1 : -1;
    if (ka.isNull) return 0;
    if (typeof ka.key === 'number' && typeof kb.key === 'number') return (ka.key - kb.key) * dirMul;
    return String(ka.key).localeCompare(String(kb.key)) * dirMul;
  });
}
