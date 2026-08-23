import { OfferingSession } from "../../lib/offering/types";
import { VarianceEngine } from "../../lib/offering/variance-engine";
import { Money } from "../../lib/money";
import { formatDateThai } from "../../lib/format";

export interface AccountOption {
  id: string;
  name: string;
  code?: string;
  accountType: string;
}

export interface VarianceResolutionViewProps {
  session: OfferingSession;
  explanation: string;
  accounts?: AccountOption[];
  selectedCashAccountId?: string;
  selectedBankAccountId?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
}

const ICON_LEDGER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`;
const ICON_CHECK_CIRCLE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
const ICON_SPINNER = `<svg class="gl-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>`;

/** Account label as shown in the selector, reused for the read-only posted state. */
function resolveAccountLabel(
  all: AccountOption[],
  filtered: AccountOption[],
  selectedId: string
): string {
  const pool = filtered.length > 0 ? filtered : all;
  const acc = pool.find((a) => a.id === selectedId) || pool[0];
  if (!acc) return "ไม่ระบุบัญชี";
  return `${acc.code ? `[${acc.code}] ` : ""}${acc.name}`;
}

function renderPostedDestinationRow(label: string, accountLabel: string, amount: string): string {
  return `
  <div style="
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border);
  ">
    <div style="min-width: 0;">
      <div style="font-size: var(--text-xs); color: var(--muted-foreground);">${label}</div>
      <div style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">${accountLabel}</div>
    </div>
    <span class="num-display" style="font-weight: var(--weight-semibold); white-space: nowrap;">${amount}</span>
  </div>`;
}

export function renderVarianceResolutionViewHtml(props: VarianceResolutionViewProps): string {
  const {
    session,
    explanation,
    accounts = [],
    selectedCashAccountId = "",
    selectedBankAccountId = "",
    isSubmitting = false,
    errorMessage = null,
  } = props;

  const expectedCash = session.expectedCashAmount || Money.zero();

  // A count that has not happened yet is unknown, not zero. Defaulting to
  // Money.zero() manufactures a full-expected shortage out of missing data.
  const countedCash =
    session.cashCount?.totalCashCounted ?? session.countedCashAmount ?? null;
  const hasCount = countedCash !== null;

  // confirm_offering_session gates on the stored cash_variance_amount, so that
  // column is the authority on this screen. The recomputation from the count is
  // a cross-check, never a second source of truth.
  const recomputed = hasCount
    ? VarianceEngine.calculateCashVariance(expectedCash, countedCash)
    : null;
  const storedVariance = session.cashVarianceAmount ?? null;
  const varianceAmount = storedVariance ?? recomputed?.varianceAmount ?? null;

  // Stored and recomputed disagreeing is a data-integrity problem. Report it
  // instead of silently trusting one of them.
  const hasVarianceMismatch =
    storedVariance !== null &&
    recomputed !== null &&
    !storedVariance.equals(recomputed.varianceAmount);

  const isMatch = varianceAmount !== null && varianceAmount.isZero() && !hasVarianceMismatch;
  const isShortage = varianceAmount !== null && varianceAmount.isNegative();

  const isExplained =
    session.varianceStatus === "explained" || session.varianceStatus === "acknowledged";
  const isConfirmed = session.status === "confirmed";
  const isPosted = session.status === "posted";
  const isVoided = session.status === "voided";
  const isLocked = isConfirmed || isPosted || isVoided;

  const explanationLength = (explanation || session.varianceReason || "").trim().length;
  const isExplanationValid = explanationLength >= 5;

  // The same rule confirm_offering_session enforces, evaluated by the domain
  // engine against what is actually persisted — a typed-but-unsaved explanation
  // must not unlock a button the database will refuse.
  const confirmCheck = varianceAmount === null
    ? { canConfirm: false, reason: "ยังไม่มีผลการตรวจนับเงินสด" }
    : VarianceEngine.isVarianceAcceptableForConfirmation(
        varianceAmount,
        session.varianceStatus,
        session.varianceReason
      );
  const confirmBlockedReason = hasVarianceMismatch
    ? "ยอดผลต่างในระบบไม่ตรงกับยอดที่คำนวณจากการนับ กรุณาสั่งนับใหม่"
    : confirmCheck.reason;
  const canConfirm = confirmCheck.canConfirm && !hasVarianceMismatch && !isLocked;

  // Electronic amounts
  const transferAmount = session.expectedTransferAmount || Money.zero();
  const qrAmount = session.expectedQrAmount || Money.zero();
  const electronicTotal = transferAmount.add(qrAmount);
  const hasElectronic = !electronicTotal.isZero();

  // Actual received total
  const countedCashOrZero = countedCash ?? Money.zero();
  const actualReceivedTotal = countedCashOrZero.add(electronicTotal);

  // Filter accounts
  const cashAccounts = accounts.filter(
    (a) => a.accountType === "cash_drawer" || a.accountType === "cash" || a.accountType === "petty_cash"
  );
  const bankAccounts = accounts.filter(
    (a) => a.accountType === "bank" || a.accountType === "electronic_wallet"
  );

  return `
  <div class="gl-fade-in" style="max-width: 960px; margin: 0 auto; padding: 24px 16px;">
    <!-- Breadcrumb & Back -->
    <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <a href="#/offerings" style="display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: var(--muted-foreground); text-decoration: none;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        <span>กลับหน้ารายการเงินถวาย</span>
      </a>

      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 12px; color: var(--muted-foreground);">สถานะปัจจุบัน:</span>
        <span style="
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          ${
            isPosted ? 'background: var(--secondary); color: var(--on-info-muted); border: 1px solid var(--border);' :
            isConfirmed ? 'background: var(--income-muted); color: var(--on-income-muted); border: 1px solid var(--approved);' :
            isExplained ? 'background: var(--secondary); color: var(--on-info-muted); border: 1px solid var(--border);' :
            !isMatch ? 'background: var(--expense-muted); color: var(--on-expense-muted); border: 1px solid var(--expense);' :
            'background: var(--income-muted); color: var(--on-income-muted); border: 1px solid var(--approved);'
          }
        ">
          ${
            isPosted ? '● บันทึกลงสมุดบัญชีแล้ว' :
            isConfirmed ? '● ยืนยันแล้ว' :
            isExplained ? '● บันทึกคำชี้แจงแล้ว' :
            !isMatch ? '● รอตรวจสอบผลต่าง' :
            '● ตรวจนับตรง'
          }
        </span>
      </div>
    </div>

    <!-- Header Card -->
    <div style="
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg, 12px);
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    ">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="background: var(--primary-light); color: var(--primary); font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
              ${isPosted ? 'ลงบัญชีแล้ว' : isConfirmed ? 'พร้อมลงบัญชี' : 'ผลต่างเงินสด'}
            </span>
            <h1 style="font-size: 20px; font-weight: 800; color: var(--foreground); margin: 0;">
              ${isPosted ? 'บันทึกเข้าสมุดบัญชีแยกประเภทสมบูรณ์แล้ว' : isConfirmed ? 'บันทึกเข้าสมุดบัญชีแยกประเภท' : 'จัดการและรับทราบผลต่างเงินสด'}
            </h1>
          </div>
          <p style="font-size: 13.5px; color: var(--muted-foreground); margin: 0;">
            ${session.serviceName} · ${formatDateThai(session.serviceDate)}
          </p>
        </div>

        <a href="#/offerings/${session.id}" id="btn-back-to-cash-count" style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--foreground);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>
          <span>ดูรายละเอียดการนับธนบัตร</span>
        </a>
      </div>
    </div>

    <!-- Error Banner -->
    ${errorMessage ? `
      <div style="background: var(--expense-muted); border: 1px solid var(--expense); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; color: var(--on-expense-muted); font-size: 13.5px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style="font-weight: 600;">${errorMessage}</span>
      </div>
    ` : ""}

    ${hasVarianceMismatch ? `
      <div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: 20px;">
        <div class="gl-notice__body">
          <strong>ยอดผลต่างในระบบไม่ตรงกับยอดที่คำนวณจากการนับ</strong>
          <div style="margin-top: var(--space-1);">
            ระบบบันทึกไว้ ${storedVariance?.format({ showSign: true })} แต่คำนวณจากการนับได้ ${recomputed?.varianceAmount.format({ showSign: true })}
            — ยืนยันรอบนี้ไม่ได้จนกว่าจะสั่งนับใหม่
          </div>
        </div>
      </div>
    ` : ""}

    <!-- Variance KPI Grid -->
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    ">
      <!-- Expected Cash Card -->
      <div style="
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg, 12px);
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      ">
        <div style="font-size: 12px; font-weight: 700; color: var(--muted-foreground); text-transform: uppercase; margin-bottom: 6px;">ยอดเงินสดคาดหวัง
        </div>
        <div class="num-display" style="font-size: 26px; font-weight: 800; color: var(--foreground);">
          ${expectedCash.format()}
        </div>
        <div style="font-size: 12px; color: var(--muted-foreground); margin-top: 4px;">ยอดรวมจากซองถวายและตู้บริจาค
        </div>
      </div>

      <!-- Actual Cash Counted Card -->
      <div style="
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg, 12px);
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      ">
        <div style="font-size: 12px; font-weight: 700; color: var(--muted-foreground); text-transform: uppercase; margin-bottom: 6px;">ยอดเงินสดนับได้จริง
        </div>
        <div class="num-display" style="font-size: 26px; font-weight: 800; color: ${hasCount ? "var(--info)" : "var(--muted-foreground)"};">
          ${hasCount ? countedCash.format() : "—"}
        </div>
        <div style="font-size: 12px; color: var(--muted-foreground); margin-top: 4px;">
          ${hasCount ? "ยอดรวมธนบัตร + เหรียญที่ตรวจนับจริง" : "ยังไม่มีผลการตรวจนับเงินสด"}
        </div>
      </div>

      <!-- Variance Card -->
      ${varianceAmount === null ? `
      <div class="gl-card">
        <div class="kicker" style="margin-bottom: 6px;">ผลต่างเงินสด</div>
        <div class="num-display" style="font-size: 26px; font-weight: var(--weight-bold); color: var(--muted-foreground);">—</div>
        <div style="font-size: 12px; color: var(--muted-foreground); margin-top: 4px;">
          ยังไม่มีผลการตรวจนับเงินสด
        </div>
      </div>
      ` : `
      <div style="
        background: ${hasVarianceMismatch ? 'var(--expense-muted)' : isMatch ? 'var(--income-muted)' : isShortage ? 'var(--expense-muted)' : 'var(--pending-muted)'};
        border: 1px solid ${hasVarianceMismatch ? 'var(--expense)' : isMatch ? 'var(--approved)' : isShortage ? 'var(--expense)' : 'var(--pending)'};
        border-radius: var(--radius-lg, 12px);
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      ">
        <div style="font-size: 12px; font-weight: 700; color: ${isMatch ? 'var(--on-income-muted)' : isShortage ? 'var(--on-expense-muted)' : 'var(--on-pending-muted)'}; text-transform: uppercase; margin-bottom: 6px;">
          ${isMatch ? 'ผลต่างเงินสด' : isShortage ? 'ผลต่างเงินสดขาด' : 'ผลต่างเงินสดเกิน'}
        </div>
        <div class="num-display" style="
          font-size: 26px;
          font-weight: 900;
          color: ${isMatch ? 'var(--on-income-muted)' : isShortage ? 'var(--expense)' : 'var(--on-pending-muted)'};
        ">
          ${varianceAmount.format({ showSign: true })}
        </div>
        <div style="font-size: 12px; color: ${isMatch ? 'var(--on-income-muted)' : isShortage ? 'var(--on-expense-muted)' : 'var(--on-pending-muted)'}; margin-top: 4px; font-weight: 600;">
          ${isMatch ? '✓ ยอดตรวจนับตรงกันสมบูรณ์' : isShortage ? ' เงินสดขาดจากยอดบันทึก' : ' เงินสดเกินจากยอดบันทึก'}
        </div>
      </div>
      `}
    </div>

    <!-- Variance Explanation & Recount Section -->
    ${varianceAmount !== null && !isMatch ? `
      <div style="
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg, 12px);
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 800; color: var(--foreground); margin: 0 0 4px 0;">ระบุคำชี้แจงผลต่าง หรือสั่งตรวจนับใหม่
            </h2>
            <p style="font-size: 13px; color: var(--muted-foreground); margin: 0;">ตามระเบียบการเงิน หากยอดตรวจนับไม่ตรง ต้องระบุคำชี้แจง (≥ 5 ตัวอักษร) หรือทำการนับใหม่เพื่อความโปร่งใส
            </p>
          </div>

          ${!isLocked ? `
            <button
              type="button"
              id="btn-variance-recount"
              style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 9px 16px;
                border-radius: var(--radius-md, 10px);
                border: 1px solid var(--primary);
                background: var(--accent);
                color: var(--accent-foreground);
                font-size: 13px;
                font-weight: 700;
                cursor: ${isSubmitting ? 'not-allowed' : 'pointer'};
              "
              ${isSubmitting ? "disabled" : ""}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>สั่งนับใหม่</span>
            </button>
          ` : ""}
        </div>

        <!-- Explanation Form -->
        <div style="margin-top: 16px;">
          <label style="display: block; font-size: 13.5px; font-weight: 700; color: var(--foreground); margin-bottom: 6px;">คำอธิบายสาเหตุผลต่าง <span style="color: var(--expense);">*</span>
          </label>
          <textarea
            id="input-variance-explanation"
            rows="3"
            placeholder="ตัวอย่าง: ตรวจสอบซองแล้วพบผู้ถวายเขียนยอดหน้าซอง 1,000 บาทแต่ในซองใส่เงินจริง 900 บาท..."
            style="
              width: 100%;
              padding: 12px 14px;
              border-radius: var(--radius-md, 8px);
              border: 1px solid var(--border);
              background: ${isLocked ? 'var(--secondary)' : 'var(--card)'};
              font-family: inherit;
              font-size: 14px;
              color: var(--foreground);
              box-sizing: border-box;
              resize: vertical;
            "
            ${isLocked ? "disabled" : ""}
          >${explanation || session.varianceReason || ""}</textarea>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 12px;">
            <div id="label-char-counter" style="color: ${explanationLength < 5 ? 'var(--expense)' : 'var(--income)'}; font-weight: 600;">
              ${explanationLength < 5 ? ` กรุณากรอกอย่างน้อย 5 ตัวอักษร (ปัจจุบัน ${explanationLength}/5)` : `✓ ความยาวคำชี้แจงถูกต้อง (${explanationLength} ตัวอักษร)`}
            </div>

            ${!isLocked ? `
              <button
                type="button"
                id="btn-variance-explain"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  padding: 8px 20px;
                  border-radius: var(--radius-md, 10px);
                  border: none;
                  background: ${!isExplanationValid || isSubmitting ? 'var(--muted-foreground)' : 'var(--info)'};
                  color: var(--info-foreground);
                  font-size: 13px;
                  font-weight: 700;
                  cursor: ${!isExplanationValid || isSubmitting ? 'not-allowed' : 'pointer'};
                "
                ${!isExplanationValid || isSubmitting ? "disabled" : ""}
              >
                ${isSubmitting ? `
                  <svg class="gl-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
                  <span>กำลังบันทึก...</span>
                ` : `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span>บันทึกคำชี้แจง</span>
                `}
              </button>
            ` : ""}
          </div>
        </div>
      </div>
    ` : `
      <!-- Zero Match Banner -->
      <div style="
        background: var(--income-muted);
        border: 1px solid var(--approved);
        border-radius: var(--radius-lg, 12px);
        padding: 20px 24px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        gap: 14px;
      ">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--income); color: var(--income-foreground); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; flex-shrink: 0;">
          ✓
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: var(--on-income-muted);">ยอดตรวจนับเงินสดตรงกับยอดบันทึกสมบูรณ์
          </div>
          <div style="font-size: 13px; color: var(--on-income-muted); margin-top: 2px;">ไม่มีผลต่างเงินสด สามารถดำเนินการยืนยันความถูกต้องรอบเงินถวาย ได้ทันที
          </div>
        </div>
      </div>
    `}

    <!-- Confirmation Section (Active before confirmation) -->
    ${!isConfirmed && !isPosted ? `
      <div style="
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg, 12px);
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: var(--foreground); margin: 0 0 4px 0;">การยืนยันรอบเงินถวาย
            </h3>
            <p style="font-size: 13px; color: var(--muted-foreground); margin: 0;">เมื่อตรวจสอบผลต่างและบันทึกคำชี้แจงครบถ้วน ให้กดยืนยันรอบเงินถวายเพื่อล็อกข้อมูล
            </p>
          </div>

          <button
            type="button"
            id="btn-confirm-session"
            style="
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 12px 28px;
              border-radius: var(--radius-md, 10px);
              border: none;
              background: ${!canConfirm || isSubmitting ? 'var(--muted-foreground)' : 'var(--income)'};
              color: var(--income-foreground);
              font-size: 14px;
              font-weight: 800;
              cursor: ${!canConfirm || isSubmitting ? 'not-allowed' : 'pointer'};
              box-shadow: ${canConfirm ? '0 2px 6px rgba(22, 163, 74, 0.3)' : 'none'};
            "
            ${!canConfirm || isSubmitting ? "disabled" : ""}
          >
            ${isSubmitting ? `
              <svg class="gl-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
              <span>กำลังยืนยันรอบเงินถวาย...</span>
            ` : `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>ยืนยันความถูกต้องรอบเงินถวาย</span>
            `}
          </button>
        </div>

        ${!canConfirm ? `
          <div style="margin-top: 12px; font-size: 12.5px; color: var(--expense); font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>${confirmBlockedReason || "ปุ่มยืนยันจะเปิดให้ใช้งานเมื่อผลต่างเป็น 0 หรือบันทึกคำชี้แจงผลต่างเรียบร้อยแล้วเท่านั้น"}</span>
          </div>
        ` : ""}
      </div>
    ` : ""}

    <!-- Post to ledger -->
    ${isConfirmed || isPosted ? `
      <section class="gl-card${isPosted ? "" : " gl-card--attention"}" aria-labelledby="gl-posting-title" style="margin-bottom: var(--space-6);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-5);">
          <div style="min-width: 0;">
            <span class="gl-badge ${isPosted ? "gl-badge--approved" : "gl-badge--pending"}">
              ${isPosted ? "บันทึกบัญชีสำเร็จ" : "พร้อมบันทึกบัญชี"}
            </span>
            <h2 id="gl-posting-title" style="font-size: var(--text-lg); font-weight: var(--weight-bold); margin: var(--space-2) 0 0;">
              การบันทึกลงสมุดบัญชีแยกประเภท
            </h2>
            ${isPosted ? "" : `
              <p style="font-size: var(--text-xs); color: var(--muted-foreground); margin: var(--space-1) 0 0;">
                ระบบจะลงบัญชีคู่ กระจายเข้าบัญชีสินทรัพย์และกองทุนตามที่ระบุไว้
              </p>
            `}
          </div>

          ${isPosted && session.financialTransactionId ? `
            <div id="badge-posted-tx" class="gl-badge gl-badge--neutral" style="font-family: monospace;">
              ${ICON_LEDGER}
              <span>TX: ${session.financialTransactionId.substring(0, 13)}...</span>
            </div>
          ` : ""}
        </div>

        ${isPosted ? `
          <div class="gl-surface" style="margin-bottom: var(--space-5);">
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">ยอดที่บันทึกเข้าบัญชี</div>
            <div class="num-display" style="
              font-size: var(--text-4xl);
              font-weight: var(--weight-bold);
              letter-spacing: var(--tracking-heading);
              line-height: var(--leading-heading);
            ">${actualReceivedTotal.format()}</div>
          </div>

          <div class="gl-rows" style="margin-bottom: var(--space-5);">
            ${renderPostedDestinationRow("บัญชีเงินสดรับ", resolveAccountLabel(accounts, cashAccounts, selectedCashAccountId), countedCashOrZero.format())}
            ${hasElectronic ? renderPostedDestinationRow("บัญชีเงินฝากธนาคาร", resolveAccountLabel(accounts, bankAccounts, selectedBankAccountId), electronicTotal.format()) : ""}
          </div>
        ` : ""}

        <!-- Double-entry breakdown -->
        <div class="gl-surface" style="margin-bottom: var(--space-5);">
          <div class="kicker" style="margin-bottom: var(--space-3);">การบันทึกรายการบัญชีคู่</div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4);">
            <div class="gl-card gl-card--tight">
              <div style="display: flex; justify-content: space-between; gap: var(--space-3); font-size: var(--text-xs); font-weight: var(--weight-semibold); margin-bottom: var(--space-2);">
                <span>ฝั่งเดบิต</span>
                <span class="num-display">${actualReceivedTotal.format()}</span>
              </div>
              <div class="gl-rows">
                <div style="display: flex; justify-content: space-between; gap: var(--space-3); font-size: var(--text-sm); padding: var(--space-1) 0; border-bottom: 1px solid var(--border);">
                  <span style="color: var(--muted-foreground);">บัญชีเงินสด</span>
                  <span class="num-display" style="font-weight: var(--weight-semibold);">${countedCashOrZero.format()}</span>
                </div>
                ${hasElectronic ? `
                  <div style="display: flex; justify-content: space-between; gap: var(--space-3); font-size: var(--text-sm); padding: var(--space-1) 0; border-bottom: 1px solid var(--border);">
                    <span style="color: var(--muted-foreground);">บัญชีธนาคาร</span>
                    <span class="num-display" style="font-weight: var(--weight-semibold);">${electronicTotal.format()}</span>
                  </div>
                ` : ""}
              </div>
            </div>

            <div class="gl-card gl-card--tight">
              <div style="display: flex; justify-content: space-between; gap: var(--space-3); font-size: var(--text-xs); font-weight: var(--weight-semibold); margin-bottom: var(--space-2);">
                <span>ฝั่งเครดิต</span>
                <span class="num-display">${actualReceivedTotal.format()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: var(--space-3); font-size: var(--text-sm); padding: var(--space-1) 0;">
                <span style="color: var(--muted-foreground);">ยอดจัดสรรเข้ากองทุน</span>
                <span class="num-display" style="font-weight: var(--weight-semibold);">${actualReceivedTotal.format()}</span>
              </div>
              <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: var(--space-1);">
                กระจายตามสัดส่วนช่องทางและกองทุนที่ระบุไว้
              </div>
            </div>
          </div>
        </div>

        ${!isPosted ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-5);">
            <div class="gl-field">
              <label class="gl-label" for="select-posting-cash-account">
                บัญชีเงินสดรับ <span style="color: var(--destructive);" aria-hidden="true">*</span>
              </label>
              <select id="select-posting-cash-account" class="gl-select">
                ${(cashAccounts.length > 0 ? cashAccounts : accounts).map((acc) => `
                  <option value="${acc.id}" ${acc.id === selectedCashAccountId ? "selected" : ""}>
                    ${acc.code ? `[${acc.code}] ` : ""}${acc.name}
                  </option>
                `).join("")}
              </select>
            </div>

            <div class="gl-field">
              <label class="gl-label" for="select-posting-bank-account">
                บัญชีเงินฝากธนาคาร ${hasElectronic ? '<span style="color: var(--destructive);" aria-hidden="true">*</span>' : ""}
              </label>
              <select id="select-posting-bank-account" class="gl-select"
                ${!hasElectronic && bankAccounts.length === 0 ? "disabled" : ""}>
                ${(bankAccounts.length > 0 ? bankAccounts : accounts).map((acc) => `
                  <option value="${acc.id}" ${acc.id === selectedBankAccountId ? "selected" : ""}>
                    ${acc.code ? `[${acc.code}] ` : ""}${acc.name}
                  </option>
                `).join("")}
              </select>
            </div>
          </div>

          <div class="gl-actions">
            <button type="button" id="btn-post-to-ledger" class="gl-btn gl-btn--primary" ${isSubmitting ? "disabled" : ""}>
              ${isSubmitting
                ? `${ICON_SPINNER}<span>กำลังบันทึก...</span>`
                : `${ICON_LEDGER}<span>บันทึกลงสมุดบัญชีแยกประเภท</span>`}
            </button>
          </div>
        ` : `
          <div class="gl-notice gl-notice--success" role="status">
            ${ICON_CHECK_CIRCLE}
            <div class="gl-notice__body">
              รอบเงินถวายนี้ได้รับการบันทึกเข้าสมุดบัญชีแยกประเภทเรียบร้อยแล้ว และถูกล็อกอย่างถาวร
            </div>
          </div>
        `}
      </section>
    ` : ""}
  </div>
  `;
}
