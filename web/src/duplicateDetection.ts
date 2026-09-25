import type { SlipRecord } from './types';

/** A duplicate is another slip with the same reference number AND amount. */
export function findDuplicate(existing: SlipRecord[], candidate: SlipRecord): SlipRecord | undefined {
  const ref = candidate.parsed.referenceNo.value;
  const amount = candidate.parsed.amount.value;
  if (!ref || amount == null) return undefined;

  return existing.find(
    (s) => s.id !== candidate.id && s.parsed.referenceNo.value === ref && s.parsed.amount.value === amount,
  );
}
