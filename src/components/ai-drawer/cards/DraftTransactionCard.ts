import { formatDateThai } from "../../../lib/format";
import { escapeHtml } from "../html";
import type { DraftTransactionPayload } from "../types";

export interface DraftCardRefs {
  /** Position of this draft inside the controller's rendered-draft list. */
  readonly draftIndex: number;
}

/**
 * DRAFT card — explicitly labelled as non-committed, with a button that
 * hands the user over to the Transactions page for review/editing.
 */
export function renderDraftTransactionCard(draft: DraftTransactionPayload, refs: DraftCardRefs): string {
  const sourceRow = draft.sourceFundName
    ? `<div class="gl-aid-fact"><span>กองทุนต้นทาง</span><span>${escapeHtml(draft.sourceFundName)}</span></div>`
    : "";
  return `
    <div class="gl-aid-card">
      <div class="gl-aid-card-head">
        <span class="gl-aid-card-label">ร่างรายการ</span>
        <span class="gl-aid-status">ยังไม่มีผลทางบัญชี</span>
      </div>
      <div class="gl-aid-facts">
        <div class="gl-aid-fact"><span>จำนวนเงิน</span><strong class="num-display">${escapeHtml(draft.amount)}</strong></div>
        <div class="gl-aid-fact"><span>หมวด</span><span>${escapeHtml(draft.category)}</span></div>
        ${sourceRow}
        <div class="gl-aid-fact"><span>กองทุนปลายทาง</span><span>${escapeHtml(draft.fundName)}</span></div>
        <div class="gl-aid-fact"><span>รายละเอียด</span><span>${escapeHtml(draft.description)}</span></div>
        <div class="gl-aid-fact"><span>วันที่ที่แนะนำ</span><span>${escapeHtml(formatDateThai(draft.suggestedDate))}</span></div>
      </div>
      <p class="gl-aid-note">ร่างนี้ยังไม่มีการตัดหรือเพิ่มยอดเงินในกองทุนจริง</p>
      <button
        type="button"
        class="gl-btn gl-btn--secondary gl-btn--sm gl-aid-card-btn"
        data-aid-draft-review="${refs.draftIndex}"
      >ตรวจทานและแก้ไขในหน้ารายการเงิน</button>
    </div>
  `;
}
