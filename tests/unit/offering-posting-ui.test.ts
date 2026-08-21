import { describe, it, expect } from "vitest";
import { Money } from "../../src/lib/money";
import { OfferingSession } from "../../src/lib/offering/types";
import {
  AccountOption,
  renderVarianceResolutionViewHtml,
} from "../../src/components/offering/VarianceResolutionView";

describe("M3 UI Components — Slice 4", () => {
  const accounts: AccountOption[] = [
    { id: "acct-cash-1", name: "กล่องเงินสดประจำสัปดาห์", code: "1001", accountType: "cash" },
    { id: "acct-bank-1", name: "บัญชีธนาคารกรุงเทพ", code: "1002", accountType: "bank" },
  ];

  const confirmedSession: OfferingSession = {
    id: "session-confirmed-001",
    churchId: "church-test",
    serviceDate: "2026-08-23",
    serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
    status: "confirmed",
    expectedCashAmount: Money.from("10000.00"),
    expectedTransferAmount: Money.from("5000.00"),
    expectedQrAmount: Money.from("3450.00"),
    expectedTotalAmount: Money.from("18450.00"),
    countedCashAmount: Money.from("10000.00"),
    cashVarianceAmount: Money.zero(),
    varianceStatus: "zero_match",
    counter1Id: "user-1",
    counter2Id: "user-2",
  };

  it("should render Post to Ledger section with double-entry preview when session is confirmed", () => {
    const html = renderVarianceResolutionViewHtml({
      session: confirmedSession,
      explanation: "",
      accounts,
      selectedCashAccountId: "acct-cash-1",
      selectedBankAccountId: "acct-bank-1",
    });

    expect(html).toContain("การบันทึกลงสมุดบัญชีแยกประเภท");
    expect(html).toContain("พร้อมบันทึกบัญชี");
    expect(html).toContain("ฝั่งเดบิต");
    expect(html).toContain("ฝั่งเครดิต");
    expect(html).toContain("18,450.00");
    expect(html).toContain("select-posting-cash-account");
    expect(html).toContain("select-posting-bank-account");
    expect(html).toContain("btn-post-to-ledger");
    expect(html).toContain("บันทึกลงสมุดบัญชีแยกประเภท");
  });

  it("should populate account selectors with cash and bank options", () => {
    const html = renderVarianceResolutionViewHtml({
      session: confirmedSession,
      explanation: "",
      accounts,
      selectedCashAccountId: "acct-cash-1",
      selectedBankAccountId: "acct-bank-1",
    });

    expect(html).toContain("[1001] กล่องเงินสดประจำสัปดาห์");
    expect(html).toContain("[1002] บัญชีธนาคารกรุงเทพ");
  });

  it("should render posted state with transaction badge and locked banner", () => {
    const postedSession: OfferingSession = {
      ...confirmedSession,
      status: "posted",
      financialTransactionId: "tx-fin-777888-999",
      postedAt: "2026-08-23T12:00:00Z",
      postedBy: "treasurer-id",
    };

    const html = renderVarianceResolutionViewHtml({
      session: postedSession,
      explanation: "",
      accounts,
    });

    expect(html).toContain("บันทึกบัญชีสำเร็จ");
    expect(html).toContain("badge-posted-tx");
    expect(html).toContain("TX: tx-fin-777888...");
    expect(html).toContain("รอบเงินถวายนี้ได้รับการบันทึกเข้าสมุดบัญชีแยกประเภทเรียบร้อยแล้ว และถูกล็อกอย่างถาวร");
    expect(html).not.toContain("btn-post-to-ledger");
  });

  it("should correctly preview multi-channel totals with physical count shortage", () => {
    const shortageConfirmedSession: OfferingSession = {
      ...confirmedSession,
      expectedCashAmount: Money.from("10000.00"),
      countedCashAmount: Money.from("6950.00"),
      cashVarianceAmount: Money.from("-3050.00"),
      varianceStatus: "explained",
      varianceReason: "ตรวจสอบซองพบผู้ถวายใส่เงินไม่ครบ 3,050 บาท",
    };

    const html = renderVarianceResolutionViewHtml({
      session: shortageConfirmedSession,
      explanation: "ตรวจสอบซองพบผู้ถวายใส่เงินไม่ครบ 3,050 บาท",
      accounts,
      selectedCashAccountId: "acct-cash-1",
      selectedBankAccountId: "acct-bank-1",
    });

    // Actual received total = 6,950 + 5,000 + 3,450 = 15,400.00
    expect(html).toContain("15,400.00");
    expect(html).toContain("6,950.00");
    expect(html).toContain("8,450.00"); // 5,000 + 3,450
  });
});
