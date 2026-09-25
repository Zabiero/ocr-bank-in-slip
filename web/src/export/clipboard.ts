import type { SlipRecord } from '../types';
import { slipsToRows } from './toRows';

export function slipsToTsv(slips: SlipRecord[]): string {
  const rows = slipsToRows(slips);
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]) as Array<keyof (typeof rows)[number]>;
  const lines = [headers.join('\t'), ...rows.map((row) => headers.map((h) => String(row[h])).join('\t'))];
  return lines.join('\n');
}

export async function copySlipsToClipboard(slips: SlipRecord[]): Promise<void> {
  await navigator.clipboard.writeText(slipsToTsv(slips));
}
