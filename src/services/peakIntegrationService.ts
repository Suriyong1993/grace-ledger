// src/services/peakIntegrationService.ts
// Integration Engine for PEAK Account (PEAK Engine API) Compatible Payload & CSV Export

export interface PEAKExpensePayload {
  contactCode?: string;
  contactName: string;
  taxId?: string;
  issueDate: string;
  dueDate?: string;
  referenceNo?: string;
  description: string;
  category: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentChannel: "Bank Transfer" | "Cash" | "PromptPay" | "Credit Card";
  status: "Draft" | "Approved" | "Paid";
}

export function convertToPEAKFormat(expense: {
  id?: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  vendor?: string;
  taxId?: string;
  vatAmount?: number;
}): PEAKExpensePayload {
  const total = expense.amount || 0;
  const vat = expense.vatAmount ?? Math.round((total - total / 1.07) * 100) / 100;
  const subtotal = Math.round((total - vat) * 100) / 100;

  return {
    contactName: expense.vendor || "ผู้ให้บริการทั่วไป",
    taxId: expense.taxId || "0105500000000",
    issueDate: expense.date || new Date().toISOString().split("T")[0],
    dueDate: expense.date,
    referenceNo: `EXP-${expense.id ? expense.id.slice(0, 8) : Date.now().toString().slice(-6)}`,
    description: expense.description,
    category: expense.category || "ค่าใช้จ่ายทั่วไป",
    subtotal,
    vatAmount: vat,
    totalAmount: total,
    paymentChannel: "Bank Transfer",
    status: "Approved",
  };
}

// Generate PEAK Account Compatible Import CSV
export function exportToPEAKCSV(expenses: Array<Parameters<typeof convertToPEAKFormat>[0]>): void {
  const peakData = expenses.map(convertToPEAKFormat);

  const headers = [
    "วันที่ออกเอกสาร",
    "ชื่อผู้ขาย/ร้านค้า",
    "เลขผู้เสียภาษี",
    "เลขที่เอกสารอ้างอิง",
    "รายละเอียดค่าใช้จ่าย",
    "หมวดหมู่บัญชี PEAK",
    "ยอดก่อนภาษี (Subtotal)",
    "ภาษีมูลค่าเพิ่ม (VAT 7%)",
    "ยอดรวมสุทธิ (Grand Total)",
    "ช่องทางชำระเงิน",
    "สถานะเอกสาร PEAK",
  ];

  const rows = peakData.map((d) => [
    d.issueDate,
    `"${d.contactName}"`,
    `"${d.taxId}"`,
    `"${d.referenceNo}"`,
    `"${d.description}"`,
    `"${d.category}"`,
    d.subtotal,
    d.vatAmount,
    d.totalAmount,
    `"${d.paymentChannel}"`,
    `"${d.status}"`,
  ]);

  const csvString =
    "data:text/csv;charset=utf-8,\uFEFF" +
    [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvString);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `PEAK_Account_Import_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Simulate PEAK API Realtime Sync
export async function syncToPEAKAPI(
  payload: PEAKExpensePayload,
): Promise<{ success: boolean; peakDocId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 800)); // simulate network latency
  const mockPeakDocId = `PEAK-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    success: true,
    peakDocId: mockPeakDocId,
  };
}
