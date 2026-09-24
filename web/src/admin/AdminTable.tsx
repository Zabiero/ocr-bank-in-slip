import { Fragment, useMemo, useState } from 'react';
import type { SlipRow } from '../collectSubmission';
import { deleteSlipRow, getSignedImageUrls, rowToSlipRecord, updateSlipRow } from './adminSlips';
import { fetchRecordsWithImages } from './adminTrainingExport';
import { sortSlips, type SortColumn } from '../sortSlips';
import SortableHeader, { nextSortState, type SortState } from '../components/SortableHeader';
import Filters, { EMPTY_FILTERS, type FilterState } from '../components/Filters';
import { filterSlips } from '../filterSlips';
import { editSlipField, computeStatus, type EditableSlipField } from '../parsing/parseSlip';
import StatusBadge from '../components/StatusBadge';
import EditableCell from '../components/EditableCell';
import { downloadCsv } from '../export/csv';
import { downloadXlsx } from '../export/xlsx';
import { downloadPdf } from '../export/pdf';
import { copySlipsToClipboard } from '../export/clipboard';
import { downloadTrainingData } from '../export/trainingData';

interface AdminTableProps {
  rows: SlipRow[];
  onDeleted: (id: string) => void;
  onEdited: (row: SlipRow) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function AdminTable({ rows, onDeleted, onEdited }: AdminTableProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<SlipRow | null>(null);
  const [previewUrls, setPreviewUrls] = useState<{ original: string | null; processed: string | null } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [exportingTraining, setExportingTraining] = useState(false);

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const records = useMemo(() => rows.map(rowToSlipRecord), [rows]);
  const filtered = useMemo(() => filterSlips(records, filters), [records, filters]);
  const sorted = useMemo(() => (sort ? sortSlips(filtered, sort.column, sort.direction) : filtered), [filtered, sort]);
  const sortedRows = useMemo(
    () => sorted.map((r) => rowsById.get(r.id)).filter((r): r is SlipRow => Boolean(r)),
    [sorted, rowsById],
  );

  async function handleExportTrainingData() {
    setExportingTraining(true);
    try {
      const withImages = await fetchRecordsWithImages(sortedRows);
      downloadTrainingData(withImages);
    } finally {
      setExportingTraining(false);
    }
  }

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

  async function handleEditField(row: SlipRow, field: EditableSlipField, value: string) {
    const record = rowToSlipRecord(row);
    const parsed = editSlipField(record.parsed, field, value);
    // Patch only the parsed-field columns, not a fresh buildSlipRow() -
    // rowToSlipRecord() never populates image data URLs (see its comment),
    // so recomputing image paths from a record built that way would null out
    // the already-uploaded original/processed image paths on every edit.
    const updatedRow: SlipRow = {
      ...row,
      date: parsed.date.value,
      time: parsed.time.value,
      amount: parsed.amount.value,
      currency: parsed.currency.value,
      reference_no: parsed.referenceNo.value,
      bank: parsed.bank.value,
      status: computeStatus(parsed),
      masked_account_numbers: parsed.maskedAccountNumbers,
    };
    onEdited(updatedRow);
    try {
      await updateSlipRow(updatedRow);
    } catch (err) {
      onEdited(row);
      alert(`Could not save this correction: ${err instanceof Error ? err.message : String(err)}`);
    }
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

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadCsv(sorted)}
          disabled={sorted.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => downloadXlsx(sorted)}
          disabled={sorted.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Export Excel
        </button>
        <button
          type="button"
          onClick={() => downloadPdf(sorted)}
          disabled={sorted.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Export PDF
        </button>
        <button
          type="button"
          onClick={() => copySlipsToClipboard(sorted)}
          disabled={sorted.length === 0}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={handleExportTrainingData}
          disabled={sorted.length === 0 || exportingTraining}
          title="Downloads each shown slip's image plus its current field values as JSON. Fetches every image fresh, so this can take a while for a large filtered set."
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          {exportingTraining ? 'Fetching images…' : 'Export training data'}
        </button>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        Showing {sorted.length} of {rows.length} record{rows.length === 1 ? '' : 's'}. Exports respect the filters above.
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
                    <td className="px-3 py-2">
                      <EditableCell
                        value={record.parsed.date.value}
                        confidence={record.parsed.date.confidence}
                        onCommit={(v) => handleEditField(row, 'date', v)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={record.parsed.time.value}
                        confidence={record.parsed.time.confidence}
                        onCommit={(v) => handleEditField(row, 'time', v)}
                        isOptional
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={record.parsed.amount.value != null ? record.parsed.amount.value.toFixed(2) : null}
                        confidence={record.parsed.amount.confidence}
                        onCommit={(v) => handleEditField(row, 'amount', v)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={record.parsed.referenceNo.value}
                        confidence={record.parsed.referenceNo.confidence}
                        onCommit={(v) => handleEditField(row, 'referenceNo', v)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={record.parsed.bank.value}
                        confidence={record.parsed.bank.confidence}
                        onCommit={(v) => handleEditField(row, 'bank', v)}
                      />
                    </td>
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
