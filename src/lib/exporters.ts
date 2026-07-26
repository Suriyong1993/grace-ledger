import { dayjs } from "./format";

export interface ExportColumn<T> {
  key: keyof T | string;
  label: string;
  format?: (row: T) => string | number;
  align?: "left" | "right" | "center";
}

export interface ExportMeta {
  title: string;
  subtitle?: string;
  churchName?: string;
  generatedBy?: string;
  fileBase: string;
}

function stamp() {
  return dayjs().format("YYYYMMDD-HHmm");
}

function cellValue<T>(row: T, col: ExportColumn<T>): string | number {
  if (col.format) return col.format(row);
  const v = (row as Record<string, unknown>)[col.key as string];
  if (v == null) return "";
  if (typeof v === "number") return v;
  return String(v);
}

export async function exportExcel<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta) {
  const XLSX = await import("xlsx");
  const header = cols.map((c) => c.label);
  const body = rows.map((r) => cols.map((c) => cellValue(r, c)));
  const aoa = [
    [meta.churchName ?? ""],
    [meta.title],
    meta.subtitle ? [meta.subtitle] : [""],
    [
      `สร้างเมื่อ ${dayjs().format("D MMM YYYY HH:mm")}${meta.generatedBy ? ` โดย ${meta.generatedBy}` : ""}`,
    ],
    [],
    header,
    ...body,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colWidths = cols.map((c, i) => {
    const maxLen = Math.max(c.label.length, ...body.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
  });
  ws["!cols"] = colWidths;
  ws["!freeze"] = { xSplit: 0, ySplit: 6 } as unknown as never;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, meta.title.slice(0, 30) || "Report");
  XLSX.writeFile(wb, `${meta.fileBase}-${stamp()}.xlsx`);
}

export async function exportPDF<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const landscape = cols.length > 6;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(meta.churchName ?? "", pageWidth / 2, 40, { align: "center" });
  doc.setFontSize(16);
  doc.text(meta.title, pageWidth / 2, 60, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (meta.subtitle) doc.text(meta.subtitle, pageWidth / 2, 78, { align: "center" });
  doc.text(
    `Generated ${dayjs().format("D MMM YYYY HH:mm")}${meta.generatedBy ? ` by ${meta.generatedBy}` : ""}`,
    pageWidth / 2,
    meta.subtitle ? 94 : 78,
    { align: "center" },
  );

  autoTable(doc, {
    startY: meta.subtitle ? 110 : 96,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => String(cellValue(r, c)))),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 249, 244] },
    columnStyles: Object.fromEntries(cols.map((c, i) => [i, { halign: c.align ?? "left" }])),
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const current = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.text(
        `หน้า ${current} / ${pageCount}`,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" },
      );
    },
  });

  doc.save(`${meta.fileBase}-${stamp()}.pdf`);
}

export function exportCSV<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map((c) => c.label).join(",");
  const body = rows.map((r) => cols.map((c) => esc(cellValue(r, c))).join(",")).join("\n");
  const csv = `${head}\n${body}`;
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${meta.fileBase}-${stamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printReport() {
  window.print();
}

// ── Google Export ─────────────────────────────────────────────────

export async function exportGoogleSheets<T>(
  rows: T[],
  cols: ExportColumn<T>[],
  meta: ExportMeta,
  sheetId: string,
) {
  const { appendToSheet } = await import("@/services/google");
  const header = cols.map((c) => c.label);
  const body = rows.map((r) => cols.map((c) => cellValue(r, c)));
  await appendToSheet(sheetId, "A1", [
    [meta.churchName ?? ""],
    [meta.title],
    meta.subtitle ? [meta.subtitle] : [""],
    [],
    header,
    ...body,
  ]);
}

export async function exportGoogleDrive<T>(
  rows: T[],
  cols: ExportColumn<T>[],
  meta: ExportMeta,
  folderId?: string,
) {
  const { uploadToDrive } = await import("@/services/google");
  const header = cols.map((c) => c.label).join(",");
  const body = rows.map((r) => cols.map((c) => String(cellValue(r, c))).join(",")).join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  await uploadToDrive(`${meta.fileBase}-${stamp()}.csv`, blob, "text/csv", folderId);
}
