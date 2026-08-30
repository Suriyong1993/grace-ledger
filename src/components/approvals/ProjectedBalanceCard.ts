import { ProjectedFundBalanceResult } from "../../lib/transactions/types";
import { escapeHtml } from "../../lib/format";

export interface ProjectedBalanceCardProps {
  projection: ProjectedFundBalanceResult;
}

const ICON_ALERT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`;

export function renderProjectedBalanceCardHtml(props: ProjectedBalanceCardProps): string {
  const { projection } = props;
  const isDeficit = projection.isDeficit;

  const currentFormatted = projection.currentPostedBalance.format({ currency: "THB" });
  const approvedUnpostedFormatted = projection.approvedUnpostedImpact.format({
    currency: "THB",
    showSign: true,
  });
  const evaluatingFormatted = projection.evaluatingTransactionImpact.format({
    currency: "THB",
    showSign: true,
  });
  const projectedFormatted = projection.projectedBalance.format({
    currency: "THB",
    showSign: isDeficit,
  });

  const deficitNoticeHtml = isDeficit
    ? `
    <div class="gl-notice gl-notice--error" role="alert" style="margin-top: var(--space-3);">
      ${ICON_ALERT}
      <div class="gl-notice__body">
        <strong>กองทุนไม่พอจ่าย</strong> — อนุมัติแล้วยอดจะติดลบ ${projectedFormatted}
      </div>
    </div>
    `
    : "";

  const row = (label: string, value: string, valueColor: string) => `
      <div>
        <div style="color: var(--muted-foreground);">${label}</div>
        <div class="num-display" style="font-weight: var(--weight-semibold); color: ${valueColor};">${value}</div>
      </div>`;

  return `
  <div class="gl-projected-balance-card gl-card gl-card--tight${isDeficit ? " gl-card--danger" : ""}">
    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-3);">
      <span style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">
        ${escapeHtml(projection.fundName)}
      </span>
      <span style="font-size: var(--text-2xs); color: var(--muted-foreground);">
        ยอดหลังอนุมัติ
      </span>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); font-size: var(--text-xs); margin-bottom: var(--space-3);">
      ${row("ยอดปัจจุบัน", currentFormatted, "var(--foreground)")}
      ${row("อนุมัติแล้วรอลงบัญชี", approvedUnpostedFormatted, "var(--muted-foreground)")}
      <div style="grid-column: span 2; border-top: 1px solid var(--border); padding-top: var(--space-2);">
        <div style="color: var(--muted-foreground);">รายการนี้</div>
        <div class="num-display" style="font-weight: var(--weight-semibold); color: ${
          projection.evaluatingTransactionImpact.isNegative() ? "var(--expense)" : "var(--income)"
        };">
          ${evaluatingFormatted}
        </div>
      </div>
    </div>

    <div style="
      background: ${isDeficit ? "var(--expense-muted)" : "var(--secondary)"};
      color: ${isDeficit ? "var(--on-expense-muted)" : "var(--foreground)"};
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-4);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
    ">
      <span style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">
        คงเหลือหลังอนุมัติ
      </span>
      <span class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-bold);">
        ${projectedFormatted}
      </span>
    </div>

    ${deficitNoticeHtml}
  </div>
  `;
}
