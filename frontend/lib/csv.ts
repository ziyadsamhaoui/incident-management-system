/**
 * Client-side CSV export helpers.
 *
 * Uses `;` as the field separator (Excel French-locale convention) and prefixes
 * a UTF-8 BOM so accented characters survive double-click opening in Excel.
 */

function escapeCell(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Builds and downloads a CSV file from header + row data.
 *
 * @param filename  download name, e.g. `incidents-logs-2026-08-04.csv`
 * @param headers   column labels (first row)
 * @param rows      data rows — every row must align with `headers`
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(';'))
    .join('\r\n');

  // BOM (\\uFEFF) signals UTF-8 to Excel — required for French accented chars.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** ISO date (yyyy-MM-dd) for a Date, used in export filenames. */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
