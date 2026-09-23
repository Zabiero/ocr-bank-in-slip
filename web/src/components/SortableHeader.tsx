import type { SortColumn, SortDirection } from '../sortSlips';

export type SortState = { column: SortColumn; direction: SortDirection } | null;

/** Default direction when a column is first clicked - amount/date read
 * naturally highest/latest-first, while reference no./bank read A-Z first. */
export const DEFAULT_SORT_DIRECTION: Record<SortColumn, SortDirection> = {
  date: 'desc',
  time: 'desc',
  amount: 'desc',
  referenceNo: 'asc',
  bank: 'asc',
  status: 'asc',
};

export function nextSortState(current: SortState, column: SortColumn): SortState {
  if (current?.column === column) {
    return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { column, direction: DEFAULT_SORT_DIRECTION[column] };
}

export default function SortableHeader({
  label,
  column,
  className,
  sort,
  onSort,
}: {
  label: string;
  column: SortColumn;
  className: string;
  sort: SortState;
  onSort: (column: SortColumn) => void;
}) {
  const active = sort?.column === column;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`flex items-center gap-1 hover:text-slate-700 ${active ? 'text-slate-700' : ''}`}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="text-[10px]">{active ? (sort!.direction === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    </th>
  );
}
