// Gera e baixa um CSV client-side — sem round-trip ao servidor, já que os
// dados exportados já estão carregados na página (Blob + <a download>).
export function rowsToCsv(headers: string[], rows: (string | number | null)[][]): string {
  function escapeCell(value: string | number | null): string {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(";"));
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
