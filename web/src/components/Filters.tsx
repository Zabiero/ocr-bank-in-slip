import { BANKS } from '../parsing/banks';

export interface FilterState {
  search: string;
  bank: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: FilterState = { search: '', bank: '', dateFrom: '', dateTo: '' };

interface FiltersProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
}

export default function Filters({ value, onChange }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex-1 min-w-[10rem]">
        <label className="block text-xs font-medium text-slate-500">Search reference no.</label>
        <input
          type="text"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="e.g. MB2026…"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">Bank</label>
        <select
          value={value.bank}
          onChange={(e) => onChange({ ...value, bank: e.target.value })}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">All banks</option>
          {BANKS.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
          <option value="Unknown">Unknown</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">From</label>
        <input
          type="date"
          value={value.dateFrom}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">To</label>
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      {(value.search || value.bank || value.dateFrom || value.dateTo) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs font-medium text-slate-500 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
