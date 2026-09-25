import type { SlipRecord } from './types';
import type { FilterState } from './components/Filters';

function parseDdMmYyyy(value: string | null): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

/** Shared by the local results table and the admin view, so "filter by bank/
 * reference/date" behaves identically in both places. */
export function filterSlips(slips: SlipRecord[], filters: FilterState): SlipRecord[] {
  return slips.filter((s) => {
    if (filters.bank && s.parsed.bank.value !== filters.bank) return false;
    if (filters.search && !(s.parsed.referenceNo.value ?? '').toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.dateFrom || filters.dateTo) {
      const d = parseDdMmYyyy(s.parsed.date.value);
      if (!d) return false;
      if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && d > new Date(`${filters.dateTo}T23:59:59`)) return false;
    }
    return true;
  });
}
