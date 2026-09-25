import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SlipRecord } from '../types';
import { slipsToRows } from './toRows';

export function downloadPdf(slips: SlipRecord[], fileName = 'bank-slips.pdf'): void {
  const rows = slipsToRows(slips);
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text('Bank-In Slip Records', 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported ${new Date().toLocaleString()} - ${rows.length} record${rows.length === 1 ? '' : 's'}`, 14, 21);

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  autoTable(doc, {
    startY: 26,
    head: [headers],
    body: rows.map((row) => headers.map((h) => String(row[h as keyof typeof row]))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(fileName);
}
