/**
 * Client-side tabular export helpers — CSV (native), Excel (.xlsx via SheetJS)
 * and PDF (jsPDF + autotable). All three consume the same header/row shape so
 * the Logs archive can offer an identical export dropdown in every format.
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadCsv } from '@/lib/csv';

/** A single data row — cells may be numbers or display strings. */
export type ExportRow = (string | number | null | undefined)[];

/** Downloads a .xlsx workbook (SheetJS). */
export function downloadExcel(
  filename: string,
  headers: string[],
  rows: ExportRow[],
): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Incidents');
  XLSX.writeFile(wb, filename);
}

/** Downloads a landscape PDF table (jsPDF + autotable). */
export function downloadPdf(
  filename: string,
  headers: string[],
  rows: ExportRow[],
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  autoTable(doc, {
    head: [headers],
    body: rows as (string | number)[][],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { top: 12, bottom: 12, left: 10, right: 10 },
  });
  doc.save(filename);
}

/** Delegates to the existing CSV helper so all exports share one code path. */
export { downloadCsv };
