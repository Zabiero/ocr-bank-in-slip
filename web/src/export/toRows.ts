import type { SlipRecord } from '../types';

export interface ExportRow {
  '#': number;
  Date: string;
  Time: string;
  Amount: string;
  Currency: string;
  'Reference No.': string;
  Bank: string;
  Status: string;
}

const STATUS_LABEL: Record<SlipRecord['status'], string> = {
  ok: 'OK',
  needs_review: 'Needs review',
  duplicate: 'Duplicate',
  error: 'Error',
};

export function slipsToRows(slips: SlipRecord[]): ExportRow[] {
  return slips.map((slip, i) => ({
    '#': i + 1,
    Date: slip.parsed.date.value ?? '',
    Time: slip.parsed.time.value ?? '',
    Amount: slip.parsed.amount.value != null ? slip.parsed.amount.value.toFixed(2) : '',
    Currency: slip.parsed.currency.value ?? '',
    'Reference No.': slip.parsed.referenceNo.value ?? '',
    Bank: slip.parsed.bank.value ?? '',
    Status: STATUS_LABEL[slip.status],
  }));
}
