export function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function downloadCsv(filename, rows = []) {
  const csv = rows.map((row) => row.map(csvValue).join(',')).join('\r\n');
  // The BOM keeps Excel from mangling non-ASCII names in the exported report.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  // The link has to be in the document for the click to count as user-initiated, and
  // revoking the object URL in the same tick cancels the download before it starts.
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

export function sanitizeFilenamePart(value = '') {
  return String(value || 'all')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'all';
}

export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

const PRINT_STYLES = `
  body { font-family: Arial, sans-serif; color: #172033; margin: 28px; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  p { color: #5f6b7a; margin: 0; }
  .meta { display: flex; justify-content: space-between; gap: 18px; margin: 18px 0; font-size: 12px; }
  .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 18px 0; }
  .metric { border: 1px solid #dbe3ea; border-radius: 8px; padding: 10px; }
  .metric span { color: #64748b; display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .metric strong { color: #172033; display: block; font-size: 20px; margin-top: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #dbe3ea; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #f2f5f8; color: #334155; font-size: 10px; text-transform: uppercase; }
  td span { color: #64748b; font-size: 10px; }
  @media print { body { margin: 16px; } .meta { break-after: avoid; } }
`;

// Opens a print-ready window for the given table. `headers` are column titles and
// `rows` are arrays of already-formatted cell values; `metrics` renders the summary
// tiles above the table as [label, value] pairs. Returns false when popups are blocked.
export function openPrintableReport({ headers = [], metrics = [], rows = [], subtitle = '', title = 'Report' }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  const generatedAt = new Date().toLocaleString('en-GB', { hour12: true });
  const headerCells = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  const metricTiles = metrics
    .map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>${PRINT_STYLES}</style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <div class="meta">
          <span>Generated: ${escapeHtml(generatedAt)}</span>
          <span>Total rows: ${rows.length}</span>
        </div>
        ${metricTiles ? `<div class="summary">${metricTiles}</div>` : ''}
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
  return true;
}
