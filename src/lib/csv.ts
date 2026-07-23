export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  headers?: Record<keyof T, string>,
) {
  if (rows.length === 0) return "";
  const keys = (headers ? Object.keys(headers) : Object.keys(rows[0])) as (keyof T)[];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = keys.map((k) => (headers ? headers[k] : String(k))).join(",");
  const body = rows.map((r) => keys.map((k) => escape(r[k])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
