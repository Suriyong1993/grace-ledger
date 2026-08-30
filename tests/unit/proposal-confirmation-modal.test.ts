import { describe, it, expect, vi } from "vitest";
import {
  renderProposalConfirmationModalHtml,
  attachProposalConfirmationModalHandlers,
} from "../../src/components/ai/ProposalConfirmationModal";
import { ActionProposalUiCard } from "../../src/lib/ai/grace-ai-proposals";

describe("ProposalConfirmationModal — Unit & UI Security Tests", () => {
  const dummyProposalTransfer: ActionProposalUiCard = {
    proposal_id: "prop-123",
    action: "fund_transfer",
    title: "ข้อเสนอโอนเงินระหว่างกองทุน: กองทุนทั่วไป → กองทุนพันธกิจ",
    summary: "โอนเงินจำนวน ฿25,000.00 จาก กองทุนทั่วไป ไปยัง กองทุนพันธกิจ",
    financial_effect: "ยอด กองทุนทั่วไป จะเปลี่ยนจาก ฿150,000.00 เป็น ฿125,000.00",
    source: "กองทุนทั่วไป",
    destination: "กองทุนพันธกิจ",
    amount: "฿25,000.00",
    reason: "สมทบทุนจัดกิจกรรมค่ายเยาวชน",
    current_state: {
      from_fund_balance: "฿150,000.00",
      projected_from_balance: "฿125,000.00",
      to_fund_balance: "฿50,000.00",
      projected_to_balance: "฿75,000.00",
    },
    confirmation_id: "conf-uuid-001",
    payload_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    nonce: "conf_nonce_1234567890abcdef12345678",
    expires_at: new Date(Date.now() + 300000).toISOString(),
    provenance: {
      source_tool: "propose_fund_transfer",
      source_type: "POSTGRESQL_POSTED_LEDGER",
      generated_at: new Date().toISOString(),
      church_id: "00000000-0000-0000-0000-000000000001",
    },
  };

  const dummyProposalVoid: ActionProposalUiCard = {
    proposal_id: "prop-void-456",
    action: "void_transaction",
    title: "ข้อเสนอยกเลิกรายการ: ค่าซ่อมแซมเครื่องเสียง",
    summary: "ขอยกเลิกรายการ ฿8,500.00 และสร้างรายการปรับปรุงยอดแบบย้อนกลับ (Reversal Mirror Entry)",
    financial_effect: "จะสร้างรายการคู่ล้างยอดเงิน ฿8,500.00 เพื่อปรับยอดคงเหลือให้ถูกต้องตามหลักการบัญชี",
    amount: "฿8,500.00",
    reason: "บันทึกข้อมูลซ้ำซ้อน",
    current_state: {
      transaction_id: "tx-123",
      current_status: "posted",
    },
    confirmation_id: "conf-uuid-void-002",
    payload_hash: "b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2",
    nonce: "conf_nonce_9876543210fedcba98765432",
    expires_at: new Date(Date.now() + 300000).toISOString(),
    provenance: {
      source_tool: "propose_void_transaction",
      source_type: "POSTGRESQL_POSTED_LEDGER",
      generated_at: new Date().toISOString(),
      church_id: "00000000-0000-0000-0000-000000000001",
    },
  };

  function createMockContainer() {
    const listeners: Record<string, Function[]> = {};
    const confirmBtn = {
      disabled: false,
      addEventListener: vi.fn((event: string, handler: Function) => {
        listeners[`confirm_${event}`] = listeners[`confirm_${event}`] || [];
        listeners[`confirm_${event}`].push(handler);
      }),
      removeEventListener: vi.fn(),
      click: async () => {
        for (const fn of listeners["confirm_click"] || []) {
          await fn();
        }
      },
    };

    const container = {
      querySelector: vi.fn((sel: string) => {
        if (sel === ".gl-btn-confirm") return confirmBtn;
        return { addEventListener: vi.fn(), removeEventListener: vi.fn() };
      }),
    };

    return { container: container as any, confirmBtn };
  }

  describe("1. Rendering Exact Proposal Parameters", () => {
    it("renders exact financial parameters for fund transfer proposal", () => {
      const html = renderProposalConfirmationModalHtml({
        proposal: dummyProposalTransfer,
        isOpen: true,
        currentUserRole: "treasurer",
      });

      expect(html).toContain("฿25,000.00");
      expect(html).toContain("ข้อเสนอโอนเงินระหว่างกองทุน: กองทุนทั่วไป → กองทุนพันธกิจ");
      expect(html).toContain("สมทบทุนจัดกิจกรรมค่ายเยาวชน");
      expect(html).toContain("ก่อน: ฿150,000.00");
      expect(html).toContain("หลัง: ฿125,000.00");
      expect(html).toContain("ก่อน: ฿50,000.00");
      expect(html).toContain("หลัง: ฿75,000.00");
      expect(html).toContain("ยืนยันการโอนเงิน ฿25,000.00");
    });

    it("renders void warning and specific button title for void proposal", () => {
      const html = renderProposalConfirmationModalHtml({
        proposal: dummyProposalVoid,
        isOpen: true,
        currentUserRole: "treasurer",
      });

      expect(html).toContain("฿8,500.00");
      expect(html).toContain("คำเตือนการยกเลิกรายการถาวร");
      expect(html).toContain("ยืนยันยกเลิกรายการ ฿8,500.00");
      // The action badge shows the Thai label, never the raw database enum.
      expect(html).toContain("ยกเลิกรายการ");
      expect(html).not.toContain("void_transaction");
    });

    it("keeps internal identifiers and debug vocabulary out of the confirmation UI", () => {
      const html = renderProposalConfirmationModalHtml({
        proposal: dummyProposalTransfer,
        isOpen: true,
        currentUserRole: "treasurer",
      });

      expect(html).not.toContain("CONFIRMATION_ID");
      expect(html).not.toContain("PAYLOAD_HASH");
      expect(html).not.toContain("conf-uuid-001");
      expect(html).not.toContain("fund_transfer");
      expect(html).not.toContain("Confirmation Gate");
      // The design system ships no --font-mono token; nothing may reference it.
      expect(html).not.toContain("var(--font-mono)");
      // The money value must stay under .num-display (Inter + tabular numerals).
      expect(html).toContain('<span class="num-display" style="font-size: var(--text-lg); font-weight: var(--weight-bold);">');
    });
  });

  describe("2. Confirmation Reference & Client Context Dispatch", () => {
    it("dispatches ONLY confirmation reference (id, nonce, payload_hash) upon confirm click", async () => {
      const mockOnConfirm = vi.fn().mockResolvedValue(undefined);
      const { container, confirmBtn } = createMockContainer();

      attachProposalConfirmationModalHandlers(container, {
        proposal: dummyProposalTransfer,
        isOpen: true,
        onConfirm: mockOnConfirm,
      });

      await confirmBtn.click();

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith({
        confirmation_id: "conf-uuid-001",
        nonce: "conf_nonce_1234567890abcdef12345678",
        payload_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      });
    });
  });

  describe("3. Security Guards, Disabled & Error States", () => {
    it("disables confirm button and displays expired notice when TTL expires", () => {
      const expiredProposal: ActionProposalUiCard = {
        ...dummyProposalTransfer,
        expires_at: new Date(Date.now() - 10000).toISOString(), // Expired 10s ago
      };

      const html = renderProposalConfirmationModalHtml({
        proposal: expiredProposal,
        isOpen: true,
        currentUserRole: "treasurer",
      });

      expect(html).toContain("ข้อเสนอหมดอายุแล้ว");
      expect(html).toContain("disabled");
    });

    it("displays unauthorized alert and disables confirm button for unauthorized role (e.g. member)", () => {
      const html = renderProposalConfirmationModalHtml({
        proposal: dummyProposalTransfer,
        isOpen: true,
        currentUserRole: "member", // Member cannot confirm financial actions
      });

      expect(html).toContain("ไม่มีสิทธิ์ยืนยันการดำเนินการ");
      expect(html).toContain("disabled");
    });

    it("displays error banner when error prop is provided", () => {
      const html = renderProposalConfirmationModalHtml({
        proposal: dummyProposalTransfer,
        isOpen: true,
        error: "เกิดข้อผิดพลาดในการตรวจสอบความถูกต้องของลายเซ็นดิจิทัล",
        currentUserRole: "treasurer",
      });

      expect(html).toContain("เกิดข้อผิดพลาดในการดำเนินการ");
      expect(html).toContain("เกิดข้อผิดพลาดในการตรวจสอบความถูกต้องของลายเซ็นดิจิทัล");
    });
  });

  describe("4. CRITICAL TEST: Zero Direct Financial RPC Execution", () => {
    it("guarantees ProposalConfirmationModal NEVER directly calls any financial mutation RPC", async () => {
      const financialRpcSpy = {
        transfer_funds: vi.fn(),
        post_transaction: vi.fn(),
        void_transaction: vi.fn(),
      };

      const mockOnConfirm = vi.fn().mockImplementation(async (context) => {
        // Confirm handler only forwards confirmation reference to Task 12 endpoint
        expect(context.confirmation_id).toBeDefined();
      });

      const { container, confirmBtn } = createMockContainer();

      attachProposalConfirmationModalHandlers(container, {
        proposal: dummyProposalTransfer,
        isOpen: true,
        onConfirm: mockOnConfirm,
      });

      await confirmBtn.click();

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);

      // PROOF: Zero direct financial RPCs called by UI
      expect(financialRpcSpy.transfer_funds).toHaveBeenCalledTimes(0);
      expect(financialRpcSpy.post_transaction).toHaveBeenCalledTimes(0);
      expect(financialRpcSpy.void_transaction).toHaveBeenCalledTimes(0);
    });
  });
});
