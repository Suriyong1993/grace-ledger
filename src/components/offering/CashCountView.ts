import { Money } from "../../lib/money";
import { escapeHtml } from "../../lib/format";
import { OfferingSession, CashDenominations } from "../../lib/offering/types";
import { DenominationEngine } from "../../lib/offering/denomination-engine";
import { VarianceEngine } from "../../lib/offering/variance-engine";
import { renderOfferingStatusBadge } from "./OfferingSessionList";
import { formatDateThai } from "../../lib/format";

export interface ProfileOption {
  id: string;
  fullName: string;
  email?: string;
}

export interface CashCountFormState {
  counter1Id: string;
  counter2Id: string;
  denominations: CashDenominations;
}

export interface CashCountViewProps {
  session: OfferingSession;
  profiles: ProfileOption[];
  state: CashCountFormState;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
}

const ICON_BACK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><polyline points="15 18 9 12 15 6"/></svg>`;
const ICON_ALERT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`;
const ICON_PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const ICON_SAVE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
const ICON_SPIN = `<svg class="gl-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;

export function renderCashCountViewHtml(props: CashCountViewProps): string {
  const { session, profiles, state, isSubmitting = false, errorMessage } = props;

  const denomResult = DenominationEngine.calculateTotal({
    b1000: state.denominations.b1000,
    b500: state.denominations.b500,
    b100: state.denominations.b100,
    b50: state.denominations.b50,
    b20: state.denominations.b20,
    coins: state.denominations.coins,
  });

  const actualCash = denomResult.grandTotal;
  const expectedCash = session.expectedCashAmount;

  const varianceResult = VarianceEngine.calculateCashVariance(expectedCash, actualCash);
  const varianceAmount = varianceResult.varianceAmount;
  const isMatch = varianceResult.isZeroMatch;
  const isShortage = varianceResult.isShortage;

  const hasCounters = Boolean(state.counter1Id && state.counter2Id);
  const isSameCounter = hasCounters && state.counter1Id === state.counter2Id;
  const isCountersValid = hasCounters && !isSameCounter;

  const isDraft = session.status === "draft";
  const isLocked = session.status === "confirmed" || session.status === "posted" || session.status === "voided";

  const varianceStat = isMatch
    ? { cls: "gl-stat--success", head: "ยอดเงินสดตรวจนับตรงสมบูรณ์" }
    : isShortage
      ? { cls: "gl-stat--danger", head: "ยอดเงินสดตรวจนับขาด" }
      : { cls: "gl-stat--warning", head: "ยอดเงินสดตรวจนับเกิน" };

  return `
  <div class="gl-page gl-cash-count-container gl-fade-in">
    <div style="margin-bottom: var(--space-4);">
      <a href="#/offerings" style="
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--muted-foreground);
        text-decoration: none;
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
      ">
        ${ICON_BACK}
        <span>รายการเงินถวาย</span>
      </a>
    </div>

    <div class="gl-page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-3);">
      <div style="min-width: 0;">
        <div class="kicker">${formatDateThai(session.serviceDate)} · <span class="num-display">${session.id.substring(0, 8)}</span></div>
        <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-1);">
          <h1 style="margin: 0;">${escapeHtml(session.serviceName)}</h1>
          ${renderOfferingStatusBadge(session.status)}
        </div>
      </div>
    </div>

    ${errorMessage ? `
      <div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-5);">
        ${ICON_ALERT}
        <div class="gl-notice__body">${errorMessage}</div>
      </div>
    ` : ""}

    <!-- The three numbers a counting team needs: expected, counted, variance -->
    <section class="gl-section" aria-label="สรุปการตรวจนับ" style="margin-bottom: var(--space-6);">
      <div class="gl-statgrid">
        <div class="gl-stat">
          <div class="gl-stat__label">คาดว่าจะมี</div>
          <div class="gl-stat__value num-display">${expectedCash.format()}</div>
        </div>
        <div class="gl-stat">
          <div class="gl-stat__label">นับได้</div>
          <div class="gl-stat__value num-display">${actualCash.format()}</div>
        </div>
        <div class="gl-stat ${varianceStat.cls}">
          <div class="gl-stat__label">ผลต่าง</div>
          <div class="gl-stat__value num-display">${varianceAmount.format({ showSign: true })}</div>
        </div>
      </div>
      <p style="font-size: var(--text-xs); color: var(--muted-foreground); margin: var(--space-2) 0 0;">
        เทียบกับยอดเงินสดเท่านั้น · เงินโอน <span class="num-display">${session.expectedTransferAmount.format()}</span> · QR <span class="num-display">${session.expectedQrAmount.format()}</span> · รวมทุกช่องทาง <span class="num-display">${session.expectedTotalAmount.format()}</span>
      </p>
    </section>

    <!-- Dual custody -->
    <section class="gl-card" style="margin-bottom: var(--space-5);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-4);">
        <div>
          <h2 style="font-size: var(--text-md); font-weight: var(--weight-semibold); margin: 0;">ผู้ร่วมตรวจนับเงิน</h2>
          <p style="font-size: var(--text-xs); color: var(--muted-foreground); margin: var(--space-1) 0 0;">
            ต้องมีผู้ตรวจนับ 2 คนร่วมกันนับและรับผิดชอบ
          </p>
        </div>

        ${isDraft ? `
          <button type="button" id="btn-start-counting" class="gl-btn gl-btn--primary gl-btn--sm"
            ${!isCountersValid || isSubmitting ? "disabled" : ""}>
            ${ICON_PLAY}
            <span>เริ่มขั้นตอนตรวจนับเงิน</span>
          </button>
        ` : ""}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4);">
        <div class="gl-field">
          <label class="gl-label" for="select-counter-1">
            ผู้ตรวจนับคนที่ 1 <span style="color: var(--destructive);" aria-hidden="true">*</span>
          </label>
          <select id="select-counter-1" name="counter1Id" class="gl-select"
            style="${isSameCounter ? "border-color: var(--destructive);" : ""}"
            ${isLocked ? "disabled" : ""}>
            <option value="">เลือกผู้ตรวจนับ</option>
            ${profiles.map((p) => `
              <option value="${p.id}" ${p.id === state.counter1Id ? "selected" : ""}>
                ${p.fullName}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="gl-field">
          <label class="gl-label" for="select-counter-2">
            ผู้ตรวจนับคนที่ 2 <span style="color: var(--destructive);" aria-hidden="true">*</span>
          </label>
          <select id="select-counter-2" name="counter2Id" class="gl-select"
            style="${isSameCounter ? "border-color: var(--destructive);" : ""}"
            ${isLocked ? "disabled" : ""}>
            <option value="">เลือกผู้ตรวจนับ</option>
            ${profiles.map((p) => `
              <option value="${p.id}" ${p.id === state.counter2Id ? "selected" : ""}>
                ${p.fullName}
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      ${isSameCounter ? `
        <div class="gl-notice gl-notice--error" role="alert" style="margin-top: var(--space-3);">
          ${ICON_ALERT}
          <div class="gl-notice__body">ผู้ตรวจนับคนที่ 1 และคนที่ 2 ต้องเป็นคนละคนกันตามหลักการควบคุมภายใน</div>
        </div>
      ` : ""}
    </section>

    <!-- Denomination table -->
    <section class="gl-card" style="margin-bottom: var(--space-5);">
      <div class="gl-section__head">
        <h2>ตารางนับธนบัตรและเหรียญ</h2>
        <span style="font-size: var(--text-xs); color: var(--muted-foreground);">กรอกจำนวนใบ/เหรียญ</span>
      </div>

      <div class="gl-stack gl-stack--tight">
        ${renderDenomRow("฿1,000", "b1000", state.denominations.b1000, denomResult.breakdown.b1000.total, isLocked)}
        ${renderDenomRow("฿500", "b500", state.denominations.b500, denomResult.breakdown.b500.total, isLocked)}
        ${renderDenomRow("฿100", "b100", state.denominations.b100, denomResult.breakdown.b100.total, isLocked)}
        ${renderDenomRow("฿50", "b50", state.denominations.b50, denomResult.breakdown.b50.total, isLocked)}
        ${renderDenomRow("฿20", "b20", state.denominations.b20, denomResult.breakdown.b20.total, isLocked)}

        <div class="gl-denom-row gl-surface" style="
          display: grid;
          grid-template-columns: 140px 1fr 180px;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-2) var(--space-4);
        ">
          <label for="input-coins" style="font-weight: var(--weight-semibold); font-size: var(--text-sm); color: var(--foreground);">เหรียญรวม</label>

          <div style="display: flex; align-items: center; gap: var(--space-1); max-width: 220px;">
            <div style="position: relative; flex: 1;">
              <span aria-hidden="true" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-weight: var(--weight-semibold); color: var(--muted-foreground); font-size: var(--text-sm);">฿</span>
              <input
                type="number"
                step="0.01"
                min="0"
                id="input-coins"
                name="coins"
                value="${state.denominations.coins.toNumber() > 0 ? state.denominations.coins.toNumber() : ""}"
                placeholder="0.00"
                class="gl-input num-display"
                style="padding-left: 28px; text-align: right; font-weight: var(--weight-semibold);"
                ${isLocked ? "disabled" : ""}
              />
            </div>
          </div>

          <div style="text-align: right;">
            <span class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-semibold); color: var(--foreground);">
              ${denomResult.coinTotal.format()}
            </span>
          </div>
        </div>
      </div>

      <div style="
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-3);
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
      ">
        <span style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">รวมนับได้</span>
        <span class="num-display" style="font-size: var(--text-2xl); font-weight: var(--weight-bold); letter-spacing: var(--tracking-heading);">
          ${actualCash.format()}
        </span>
      </div>
    </section>

    <!-- Variance verdict -->
    <div class="gl-notice ${isMatch ? "gl-notice--success" : isShortage ? "gl-notice--error" : "gl-notice--warning"}" role="status" style="margin-bottom: var(--space-6); align-items: center;">
      <div class="gl-notice__body">
        <strong>${varianceStat.head}</strong>
      </div>
      <span class="num-display" style="font-size: var(--text-xl); font-weight: var(--weight-bold); white-space: nowrap;">
        ${varianceAmount.format({ showSign: true })}
      </span>
    </div>

    <!-- Actions -->
    <div class="gl-actionbar gl-actionbar--sticky">
      <a href="#/offerings" class="gl-btn gl-btn--ghost">กลับหน้ารายการ</a>

      <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
        ${(session.status === 'variance_review' || session.status === 'counted' || session.status === 'confirmed') ? `
          <button type="button" id="btn-go-to-resolution" class="gl-btn gl-btn--secondary">
            <span>${session.status === 'variance_review' ? 'จัดการผลต่างเงินสด' : 'ยืนยันรอบเงินถวาย'}</span>
          </button>
        ` : ""}

        ${!isLocked ? `
          <button type="button" id="btn-save-cash-count" class="gl-btn gl-btn--primary"
            ${!isCountersValid || isSubmitting ? "disabled" : ""}>
            ${isSubmitting ? `${ICON_SPIN}<span>กำลังบันทึก...</span>` : `${ICON_SAVE}<span>บันทึกผลการตรวจนับเงิน</span>`}
          </button>
        ` : `
          <span style="font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--muted-foreground);">รายการนี้ถูกล็อกแล้ว แก้ไขไม่ได้</span>
        `}
      </div>
    </div>
  </div>
  `;
}

function renderDenomRow(
  badgeText: string,
  key: string,
  count: number,
  subtotal: Money,
  isLocked: boolean
): string {
  return `
  <div class="gl-denom-row gl-surface" style="
    display: grid;
    grid-template-columns: 140px 1fr 180px;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
  ">
    <label for="input-denom-${key}" style="font-weight: var(--weight-semibold); font-size: var(--text-sm); color: var(--foreground); display: flex; align-items: center; gap: var(--space-2);">
      <span class="num-display" style="font-size: var(--text-xs); font-weight: var(--weight-semibold); background: var(--accent); color: var(--accent-foreground); padding: 2px 6px; border-radius: var(--radius-sm);">
        ${badgeText}
      </span>
      <span>ธนบัตร</span>
    </label>

    <div style="display: flex; align-items: center; gap: var(--space-1); max-width: 220px;">
      <button
        type="button"
        class="btn-denom-step gl-btn gl-btn--secondary"
        data-action="minus"
        data-denom="${key}"
        aria-label="ลดจำนวน ${badgeText}"
        style="min-height: var(--touch-target-min); min-width: var(--touch-target-min); padding: 0; font-size: var(--text-md); font-weight: var(--weight-bold);"
        ${isLocked || count <= 0 ? "disabled" : ""}
      >−</button>

      <input
        type="number"
        min="0"
        step="1"
        id="input-denom-${key}"
        class="input-denom-count gl-input num-display"
        data-denom="${key}"
        value="${count > 0 ? count : ""}"
        placeholder="0"
        style="flex: 1; min-width: 0; text-align: center; font-weight: var(--weight-semibold);"
        ${isLocked ? "disabled" : ""}
      />

      <button
        type="button"
        class="btn-denom-step gl-btn gl-btn--secondary"
        data-action="plus"
        data-denom="${key}"
        aria-label="เพิ่มจำนวน ${badgeText}"
        style="min-height: var(--touch-target-min); min-width: var(--touch-target-min); padding: 0; font-size: var(--text-md); font-weight: var(--weight-bold);"
        ${isLocked ? "disabled" : ""}
      >+</button>
    </div>

    <div style="text-align: right;">
      <span class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-semibold); color: var(--foreground);">
        ${subtotal.format()}
      </span>
    </div>
  </div>
  `;
}
