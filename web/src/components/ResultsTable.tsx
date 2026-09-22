import { Fragment, useState } from 'react';
import type { EditableSlipField } from '../parsing/parseSlip';
import type { SlipRecord } from '../types';
import EditableCell from './EditableCell';
import StatusBadge from './StatusBadge';

interface ResultsTableProps {
  slips: SlipRecord[];
  onEdit: (id: string, field: EditableSlipField, value: string) => void;
  onDelete: (id: string) => void;
  onRescan: (id: string) => void;
  rescanningId: string | null;
}

export default function ResultsTable({ slips, onEdit, onDelete, onRescan, rescanningId }: ResultsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewSlip, setPreviewSlip] = useState<SlipRecord | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  if (slips.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-500">No slips yet. Take a photo or upload one to get started.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="w-10 px-3 py-2">#</th>
            <th className="w-20 px-3 py-2">Slip</th>
            <th className="w-28 px-3 py-2">Date</th>
            <th className="w-28 px-3 py-2">Time</th>
            <th className="w-28 px-3 py-2">Amount</th>
            <th className="w-36 px-3 py-2">Reference No.</th>
            <th className="w-32 px-3 py-2">Bank</th>
            <th className="w-28 px-3 py-2">Status</th>
            <th className="w-24 px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {slips.map((slip, i) => (
            <Fragment key={slip.id}>
            <tr className="border-b border-slate-100 align-top last:border-0">
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2">
                {slip.thumbnailDataUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOriginal(false);
                      setPreviewSlip(slip);
                    }}
                    className="block rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={`View full-size image of ${slip.fileName}`}
                  >
                    <img
                      src={slip.thumbnailDataUrl}
                      alt={slip.fileName}
                      className="h-12 w-12 cursor-pointer rounded object-cover transition hover:opacity-80"
                    />
                  </button>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                    n/a
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <EditableCell
                  value={slip.parsed.date.value}
                  confidence={slip.parsed.date.confidence}
                  onCommit={(v) => onEdit(slip.id, 'date', v)}
                />
              </td>
              <td className="px-3 py-2">
                <EditableCell
                  value={slip.parsed.time.value}
                  confidence={slip.parsed.time.confidence}
                  onCommit={(v) => onEdit(slip.id, 'time', v)}
                  isOptional
                />
              </td>
              <td className="px-3 py-2">
                <EditableCell
                  value={slip.parsed.amount.value != null ? slip.parsed.amount.value.toFixed(2) : null}
                  confidence={slip.parsed.amount.confidence}
                  onCommit={(v) => onEdit(slip.id, 'amount', v)}
                />
              </td>
              <td className="px-3 py-2">
                <EditableCell
                  value={slip.parsed.referenceNo.value}
                  confidence={slip.parsed.referenceNo.confidence}
                  onCommit={(v) => onEdit(slip.id, 'referenceNo', v)}
                />
              </td>
              <td className="px-3 py-2">
                <EditableCell
                  value={slip.parsed.bank.value}
                  confidence={slip.parsed.bank.confidence}
                  onCommit={(v) => onEdit(slip.id, 'bank', v)}
                />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={slip.status} />
                {slip.errorMessage && <p className="mt-1 text-xs text-red-600">{slip.errorMessage}</p>}
              </td>
              <td className="space-x-2 whitespace-nowrap px-3 py-2">
                <button
                  type="button"
                  onClick={() => onRescan(slip.id)}
                  disabled={rescanningId === slip.id}
                  className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                >
                  {rescanningId === slip.id ? 'Scanning…' : 'Re-scan'}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === slip.id ? null : slip.id)}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  {expandedId === slip.id ? 'Hide text' : 'View text'}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(slip.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
            {expandedId === slip.id && (
              <tr className="border-b border-slate-100 bg-slate-50">
                <td colSpan={9} className="px-3 py-3">
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    Raw OCR text (overall confidence {Math.round(slip.ocrConfidence)}%, engine: {slip.ocrEngine}) —
                    account numbers are masked, everything else is exactly what OCR read:
                  </p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 text-xs text-slate-800">
                    {slip.ocrText || '(empty)'}
                  </pre>
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {previewSlip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewSlip(null)}
        >
          <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3 text-white">
              <span className="truncate text-sm">{previewSlip.fileName}</span>
              <div className="flex shrink-0 items-center gap-2">
                {previewSlip.originalImageDataUrl && (
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
                  onClick={() => setPreviewSlip(null)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
                  aria-label="Close"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            {previewSlip.originalImageDataUrl && (
              <p className="mb-1 text-center text-xs text-white/70">
                Currently viewing: <span className="font-semibold text-white">{showOriginal ? 'original photo' : 'processed (B&W) image used for OCR'}</span>
              </p>
            )}
            {(() => {
              const src = showOriginal && previewSlip.originalImageDataUrl ? previewSlip.originalImageDataUrl : previewSlip.imageDataUrl;
              return src ? (
                <img src={src} alt={previewSlip.fileName} className="max-h-[85vh] max-w-full rounded object-contain" />
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
