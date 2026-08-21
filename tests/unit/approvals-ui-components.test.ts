import { describe, it, expect } from "vitest";
import { Money } from "../../src/lib/money";
import {
  renderStatusBadgeHtml,
  renderProjectedBalanceCardHtml,
  renderApprovalDecisionSheetHtml,
  renderRejectionModalHtml,
  renderApprovalsQueueViewHtml,
} from "../../src/components/approvals";

describe("Approval Workflow UI Components — Unit Tests", () => {
  it("renders StatusBadge with correct labels and semantic color tokens for all statuses", () => {
    const draftHtml = renderStatusBadgeHtml({ status: "draft" });
    expect(draftHtml).toContain("ฉบับร่าง");

    const pendingHtml = renderStatusBadgeHtml({ status: "pending_approval" });
    expect(pendingHtml).toContain("รออนุมัติ");
    expect(pendingHtml).toContain("gl-badge--pending");

    const approvedHtml = renderStatusBadgeHtml({ status: "approved" });
    expect(approvedHtml).toContain("อนุมัติแล้ว");
    expect(approvedHtml).toContain("gl-badge--approved");

    const postedHtml = renderStatusBadgeHtml({ status: "posted" });
    expect(postedHtml).toContain("บันทึกบัญชีแล้ว");

    const rejectedHtml = renderStatusBadgeHtml({ status: "rejected" });
    expect(rejectedHtml).toContain("ปฏิเสธ");
    expect(rejectedHtml).toContain("gl-badge--rejected");

    const voidedHtml = renderStatusBadgeHtml({ status: "voided" });
    expect(voidedHtml).toContain("ยกเลิกแล้ว");
  });

  it("renders ProjectedBalanceCard with normal surplus and deficit overdraft warning", () => {
    // Normal surplus
    const surplusHtml = renderProjectedBalanceCardHtml({
      projection: {
        fundId: "f-1",
        fundName: "กองทุนเยาวชน",
        currentPostedBalance: Money.from("12010.00"),
        approvedUnpostedImpact: Money.zero(),
        evaluatingTransactionImpact: Money.from("-8500.00"),
        projectedBalance: Money.from("3510.00"),
        isDeficit: false,
      },
    });
    expect(surplusHtml).toContain("กองทุนเยาวชน");
    expect(surplusHtml).toContain("฿12,010.00");
    expect(surplusHtml).toContain("฿3,510.00");
    expect(surplusHtml).not.toContain("กองทุนไม่พอจ่าย");

    // Deficit / Overdraft
    const deficitHtml = renderProjectedBalanceCardHtml({
      projection: {
        fundId: "f-1",
        fundName: "กองทุนเยาวชน",
        currentPostedBalance: Money.from("12010.00"),
        approvedUnpostedImpact: Money.zero(),
        evaluatingTransactionImpact: Money.from("-15000.00"),
        projectedBalance: Money.from("-2990.00"),
        isDeficit: true,
        deficitAmount: Money.from("2990.00"),
      },
    });
    expect(deficitHtml).toContain("กองทุนไม่พอจ่าย");
    expect(deficitHtml).toContain("−฿2,990.00");
  });

  it("renders ApprovalDecisionSheet with Two-Person Rule lock banner when viewer is creator", () => {
    const sheetHtml = renderApprovalDecisionSheetHtml({
      item: {
        id: "tx-1",
        churchId: "c-1",
        accountId: "a-1",
        accountName: "ธนาคารกรุงเทพ",
        amount: Money.from("8500.00"),
        direction: "expense",
        status: "pending_approval",
        description: "ซื้ออุปกรณ์ค่ายเยาวชน",
        referenceNumber: "EXP-0248",
        createdBy: "u-creator",
        creatorName: "นรินทร์ สมหวัง",
        creatorInitials: "นส",
        createdAt: "2026-08-18T10:00:00Z",
        hasReceipt: true,
        receiptUrl: "https://receipt.pdf",
        splits: [],
        isCreator: true, // Viewer is creator!
      },
      projections: [
        {
          fundId: "f-1",
          fundName: "กองทุนเยาวชน",
          currentPostedBalance: Money.from("12010.00"),
          approvedUnpostedImpact: Money.zero(),
          evaluatingTransactionImpact: Money.from("-8500.00"),
          projectedBalance: Money.from("3510.00"),
          isDeficit: false,
        },
      ],
    });

    expect(sheetHtml).toContain("หลักการแบ่งแยกหน้าที่");
    expect(sheetHtml).toContain("คุณเป็นผู้สร้างรายการนี้ ไม่สามารถอนุมัติตัวเองได้");
    expect(sheetHtml).toContain("disabled");
    expect(sheetHtml).toContain("มีเอกสารใบเสร็จแนบ");
    expect(sheetHtml).toContain("ขอแก้ไข");
    expect(sheetHtml).toContain("ปฏิเสธ");
  });

  it("renders Stale State Warning when another approver processed the voucher", () => {
    const staleHtml = renderApprovalDecisionSheetHtml({
      item: {
        id: "tx-1",
        churchId: "c-1",
        accountId: "a-1",
        amount: Money.from("8500.00"),
        direction: "expense",
        status: "approved",
        description: "ซื้ออุปกรณ์ค่ายเยาวชน",
        referenceNumber: "EXP-0248",
        createdBy: "u-creator",
        createdAt: "2026-08-18T10:00:00Z",
        hasReceipt: true,
        splits: [],
        isCreator: false,
      },
      projections: [],
      isStaleState: true,
    });

    expect(staleHtml).toContain("รายการนี้ได้รับการดำเนินการไปแล้ว");
    expect(staleHtml).toContain("ปิดหน้าต่างและรีเฟรชรายการ");
  });

  it("renders RejectionModal with revision requested vs formal rejection copy", () => {
    const revisionHtml = renderRejectionModalHtml({
      transactionId: "tx-1",
      referenceNumber: "EXP-0248",
      amount: "฿8,500.00",
      type: "revision_requested",
    });
    expect(revisionHtml).toContain("ส่งรายการกลับเพื่อขอให้แก้ไข");
    expect(revisionHtml).toContain("ยืนยันการส่งกลับเพื่อแก้ไข");

    const rejectHtml = renderRejectionModalHtml({
      transactionId: "tx-1",
      referenceNumber: "EXP-0248",
      amount: "฿8,500.00",
      type: "rejected",
    });
    expect(rejectHtml).toContain("ปฏิเสธคำขอเบิกจ่าย");
    expect(rejectHtml).toContain("ยืนยันการปฏิเสธคำขอ");
  });

  it("renders ApprovalsQueueView empty state and active items list correctly", () => {
    // Empty state
    const emptyHtml = renderApprovalsQueueViewHtml({ items: [] });
    expect(emptyHtml).toContain("ไม่มีรายการค้างอนุมัติ");

    // Populated state
    const queueHtml = renderApprovalsQueueViewHtml({
      items: [
        {
          id: "tx-1",
          churchId: "c-1",
          accountId: "a-1",
          accountName: "ธนาคารกรุงเทพ",
          amount: Money.from("8500.00"),
          direction: "expense",
          status: "pending_approval",
          description: "ซื้ออุปกรณ์ค่ายเยาวชน",
          referenceNumber: "EXP-0248",
          createdBy: "u-creator",
          creatorName: "นรินทร์ สมหวัง",
          creatorInitials: "นส",
          createdAt: "2026-08-18T10:00:00Z",
          hasReceipt: true,
          splits: [],
          isCreator: false,
        },
      ],
    });

    expect(queueHtml).toContain("คิวอนุมัติ");
    expect(queueHtml).toContain("EXP-0248");
    expect(queueHtml).toContain("ซื้ออุปกรณ์ค่ายเยาวชน");
    expect(queueHtml).toContain("−฿8,500.00");
    expect(queueHtml).not.toContain("ไม่มีใบเสร็จ");
    expect(queueHtml).toContain("ดูรายละเอียด");
  });
});
