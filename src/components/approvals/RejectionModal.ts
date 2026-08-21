export interface RejectionModalProps {
  transactionId: string;
  referenceNumber?: string | null;
  amount: string;
  type: "revision_requested" | "rejected";
}

const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

export function renderRejectionModalHtml(props: RejectionModalProps): string {
  const isRevision = props.type === "revision_requested";
  const title = isRevision ? "ส่งรายการกลับเพื่อขอให้แก้ไข" : "ปฏิเสธคำขอเบิกจ่าย";
  const submitButtonText = isRevision ? "ยืนยันการส่งกลับเพื่อแก้ไข" : "ยืนยันการปฏิเสธคำขอ";
  const placeholder = isRevision
    ? "เช่น ขาดใบเสร็จแนบ หรือเลือกกองทุนผิด"
    : "เช่น ไม่อยู่ในงบประมาณ หรือไม่ผ่านนโยบายการเงิน";

  return `
  <div class="gl-modal-backdrop">
    <div class="gl-modal-content" role="dialog" aria-modal="true" aria-labelledby="gl-modal-title">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-4);">
        <div style="min-width: 0;">
          <h2 id="gl-modal-title" style="font-size: var(--text-lg); font-weight: var(--weight-bold); margin: 0;">
            ${title}
          </h2>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: var(--space-1);">
            ${props.referenceNumber || props.transactionId} · <span class="num-display">${props.amount}</span>
          </div>
        </div>
        <button type="button" class="gl-modal-close gl-btn gl-btn--ghost gl-btn--sm" aria-label="ปิด">
          ${ICON_CLOSE}
        </button>
      </div>

      <div class="gl-field" style="margin-bottom: var(--space-5);">
        <label class="gl-label" for="gl-rejection-reason">
          เหตุผล <span style="color: var(--destructive);" aria-hidden="true">*</span>
        </label>
        <textarea
          id="gl-rejection-reason"
          class="gl-textarea"
          rows="4"
          required
          aria-describedby="gl-char-count"
          placeholder="${placeholder}"></textarea>
        <div style="display: flex; justify-content: space-between; gap: var(--space-2);">
          <span id="gl-reason-error" class="gl-error-text" role="alert" style="display: none;">
            ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร
          </span>
          <span id="gl-char-count" class="gl-hint">0 / 5 ตัวอักษรขั้นต่ำ</span>
        </div>
      </div>

      <div class="gl-actions">
        <button type="button" class="gl-btn-cancel gl-btn gl-btn--ghost">ยกเลิก</button>
        <button type="button" class="gl-btn-submit gl-btn ${
          isRevision ? "gl-btn--primary" : "gl-btn--destructive"
        }">${submitButtonText}</button>
      </div>
    </div>
  </div>
  `;
}
