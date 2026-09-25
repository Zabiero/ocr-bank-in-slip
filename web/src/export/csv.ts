import type { SlipRecord } from '../types';
import { slipsToRows } from './toRows';

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function slipsToCsv(slips: SlipRecord[]): string {
  const rows = slipsToRows(slips);
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]) as Array<keyof (typeof rows)[number]>;
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(String(row[h]))).join(',')),
  ];
  return lines.join('\n');
}

export function downloadCsv(slips: SlipRecord[], fileName = 'bank-slips.csv'): void {
  const csv = slipsToCsv(slips);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
