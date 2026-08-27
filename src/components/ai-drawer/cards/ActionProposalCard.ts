import { escapeHtml } from "../html";
import type { ActionProposalPayload, AiProposalAction } from "../types";

const ACTION_LABELS: Readonly<Record<AiProposalAction, string>> = {
  post_transaction: "ข้อเสนอโพสต์รายการ",
  fund_transfer: "ข้อเสนอโอนเงินระหว่างกองทุน",
  void_transaction: "ข้อเสนอยกเลิกรายการ",
};

export function proposalActionLabel(action: AiProposalAction): string {
  return ACTION_LABELS[action];
}

/**
 * ACTION_PROPOSAL card — loud warning box plus the single button that opens
 * the existing ProposalConfirmationModal. The card never executes anything.
 */
export function renderActionProposalCard(proposal: ActionProposalPayload): string {
  const amountRow = proposal.amount
    ? `<div class="gl-aid-fact"><span>จำนวนเงิน</span><strong class="num-display">${escapeHtml(proposal.amount)}</strong></div>`
    : "";
  const effectRow = proposal.financialEffect
    ? `<div class="gl-aid-fact"><span>ผลกระทบทางการเงิน</span><span>${escapeHtml(proposal.financialEffect)}</span></div>`
    : "";
  return `
    <div class="gl-aid-card gl-aid-card--proposal">
      <div class="gl-aid-card-head">
        <span class="gl-aid-card-label">${escapeHtml(proposalActionLabel(proposal.action))}</span>
        <span class="gl-aid-status">รอการยืนยัน</span>
      </div>
      <div class="gl-aid-warning" role="alert">
        รายการนี้ต้องมีมนุษย์ยืนยันก่อนจึงจะมีผล Grace AI ไม่สามารถดำเนินการแทนคุณได้
      </div>
      <div class="gl-aid-facts">
        <div class="gl-aid-fact"><span>รายการ</span><strong>${escapeHtml(proposal.title)}</strong></div>
        ${amountRow}
        <div class="gl-aid-fact"><span>รายละเอียด</span><span>${escapeHtml(proposal.summary)}</span></div>
        ${effectRow}
      </div>
      <button
        type="button"
        class="gl-btn gl-btn--primary gl-btn--sm gl-aid-card-btn"
        data-aid-proposal-review="${escapeHtml(proposal.proposalId)}"
      >ตรวจสอบและยืนยันการดำเนินการ</button>
    </div>
  `;
}
