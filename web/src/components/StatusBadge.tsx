import type { SlipStatus } from '../types';

const STYLES: Record<SlipStatus, string> = {
  ok: 'bg-green-100 text-green-800',
  needs_review: 'bg-yellow-100 text-yellow-800',
  duplicate: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
};

const LABELS: Record<SlipStatus, string> = {
  ok: 'OK',
  needs_review: 'Needs review',
  duplicate: 'Duplicate',
  error: 'Error',
};

export default function StatusBadge({ status }: { status: SlipStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
