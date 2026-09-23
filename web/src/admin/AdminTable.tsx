import { Fragment, useMemo, useState } from 'react';
import type { SlipRow } from '../collectSubmission';
import { deleteSlipRow, getSignedImageUrls, rowToSlipRecord } from './adminSlips';
import { sortSlips, type SortColumn } from '../sortSlips';
import SortableHeader, { nextSortState, type SortState } from '../components/SortableHeader';
import Filters, { EMPTY_FILTERS, type FilterState } from '../components/Filters';
import { filterSlips } from '../filterSlips';
import StatusBadge from '../components/StatusBadge';

interface AdminTableProps {
  rows: SlipRow[];
  onDeleted: (id: string) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function AdminTable({ rows, onDeleted }: AdminTableProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<SlipRow | null>(null);
  const [previewUrls, setPreviewUrls] = useState<{ original: string | null; processed: string | null } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const records = useMemo(() => rows.map(rowToSlipRecord), [rows]);
  const filtered = useMemo(() => filterSlips(records, filters), [records, filters]);
  const sorted = useMemo(() => (sort ? sortSlips(filtered, sort.column, sort.direction) : filtered), [filtered, sort]);

  const handleSort = (column: SortColumn) => setSort((current) => nextSortState(current, column));

  async function openPreview(row: SlipRow) {
    setPreviewRow(row);
    setShowOriginal(false);
    setPreviewUrls(null);
    setPreviewLoading(true);
    const urls = await getSignedImageUrls(row);
    setPreviewUrls(urls);
    setPreviewLoading(false);
  }

  async function handleDelete(row: SlipRow) {
    if (!confirm(`Delete this record (ref "${row.reference_no ?? 'none'}", ${row.file_name})? This cannot be undone.`)) {
      return;
    }
    setDeletingId(row.id);
    try {
      await deleteSlipRow(row);
      onDeleted(row.id);
    } finally {
      setDeletingId(null);
    }
  }

  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-500">No slips submitted yet.</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <Filters value={filters} onChange={setFilters} />
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Showing {sorted.length} of {rows.length} record{rows.length === 1 ? '' : 's'}.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-10 px-3 py-2">#</th>
              <th className="w-16 px-3 py-2">Photo</th>
              <th className="w-40 px-3 py-2">Uploaded</th>
              <SortableHeader label="Date" column="date" className="w-28 px-3 py-2" sort={sort} onSort={handleSort} />
              <SortableHeader label="Time" column="time" className="w-28 px-3 py-2" sort={sort} onSort={handleSort} />
              <SortableHeader label="Amount" column="amount" className="w-28 px-3 py-2" sort={sort} onSort={handleSort} />
              <SortableHeader label="Reference No." column="referenceNo" className="w-36 px-3 py-2" sort={sort} onSort={handleSort} />
              <SortableHeader label="Bank / Wallet" column="bank" className="w-32 px-3 py-2" sort={sort} onSort={handleSort} />
              <SortableHeader label="Status" column="status" className="w-28 px-3 py-2" sort={sort} onSort={handleSort} />
              <th className="w-24 px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((record, i) => {
              const row = rowsById.get(record.id);
              if (!row) return null;
              return (
                <Fragment key={record.id}>
                  <tr className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => openPreview(row)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        View
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2">{record.parsed.date.value ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2">{record.parsed.time.value ?? <span className="text-slate-400">N/A</span>}</td>
                    <td className="px-3 py-2">
                      {record.parsed.amount.value != null ? record.parsed.amount.value.toFixed(2) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2">{record.parsed.referenceNo.value ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2">{record.parsed.bank.value ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="space-x-2 whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                        className="text-xs font-medium text-slate-600 hover:underline"
                      >
                        {expandedId === record.id ? 'Hide text' : 'View text'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingId === row.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === record.id && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td colSpan={9} className="px-3 py-3">
                        <p className="mb-1 text-xs font-medium text-slate-500">
                          Raw OCR text (overall confidence {Math.round(record.ocrConfidence)}%, engine: {record.ocrEngine}) — account
                          numbers are masked, everything else is exactly what OCR read:
                        </p>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs text-slate-800">
                          {record.ocrText || '(empty)'}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {previewRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewRow(null)}
        >
          <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3 text-white">
              <span className="truncate text-sm">{previewRow.file_name}</span>
              <div className="flex shrink-0 items-center gap-2">
                {previewUrls?.original && (
                  <button
                    type="button"
                    onClick={() => setShowOriginal((v) => !v)}
                    className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg ring-2 ring-blue-400/50 hover:bg-blue-500"
                  >
                    <span aria-hidden="true">🖼️</span>
                    {showOriginal ? 'Show processed (B&W)' : 'Show original photo'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewRow(null)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
                  aria-label="Close"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            {previewLoading && <p className="text-white">Loading image…</p>}
            {!previewLoading &&
              previewUrls &&
              (() => {
                const src = showOriginal && previewUrls.original ? previewUrls.original : previewUrls.processed;
                return src ? (
                  <img src={src} alt={previewRow.file_name} className="max-h-[85vh] max-w-full rounded object-contain" />
                ) : (
                  <p className="text-white">No image stored for this slip.</p>
                );
              })()}
          </div>
        </div>
      )}
    </div>
  );
}
