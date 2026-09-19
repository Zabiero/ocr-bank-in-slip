import type { SlipRecord } from '../types';

export default function TotalsFooter({ slips }: { slips: SlipRecord[] }) {
  const total = slips.reduce((sum, s) => sum + (s.parsed.amount.value ?? 0), 0);
  const needsReview = slips.filter((s) => s.status === 'needs_review' || s.status === 'duplicate').length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <span>
        <strong>{slips.length}</strong> slip{slips.length === 1 ? '' : 's'}
        {needsReview > 0 && <span className="ml-2 text-yellow-700">({needsReview} need review)</span>}
      </span>
      <span className="font-semibold">
        Total: RM {total.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
