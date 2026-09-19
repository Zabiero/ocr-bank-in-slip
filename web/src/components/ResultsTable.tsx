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
            <tr key={slip.id} className="border-b border-slate-100 align-top last:border-0">
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2">
                {slip.thumbnailDataUrl ? (
                  <img src={slip.thumbnailDataUrl} alt={slip.fileName} className="h-12 w-12 rounded object-cover" />
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
                  onClick={() => onDelete(slip.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
