import * as XLSX from 'xlsx';
import type { SlipRecord } from '../types';
import { slipsToRows } from './toRows';

export function downloadXlsx(slips: SlipRecord[], fileName = 'bank-slips.xlsx'): void {
  const rows = slipsToRows(slips);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Slips');
  XLSX.writeFile(workbook, fileName);
}
