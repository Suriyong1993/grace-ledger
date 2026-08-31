import { ProjectedFundBalanceResult } from "../../lib/transactions/types";
import { escapeHtml } from "../../lib/format";

export interface ProjectedBalanceCardProps {
  projection: ProjectedFundBalanceResult;
}

const ICON_ALERT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`;

export function renderProjectedBalanceCardHtml(
  props: ProjectedBalanceCardProps,
): string {
  const { projection } = props;
  const isDeficit = projection.isDeficit;

  const currentFormatted = projection.currentPostedBalance.format({
    currency: "THB",
  });
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
        <div class="gl-projbal__grid-label">${label}</div>
        <div class="num-display" style="font-weight: var(--weight-semibold); color: ${valueColor};">${value}</div>
      </div>`;

  return `
  <div class="gl-projected-balance-card gl-card gl-card--tight${isDeficit ? " gl-card--danger" : ""}">
    <div class="gl-projbal__head">
      <span class="gl-projbal__fund">
        ${escapeHtml(projection.fundName)}
      </span>
      <span class="gl-projbal__head-label">
        ยอดหลังอนุมัติ
      </span>
    </div>

    <div class="gl-projbal__grid">
      ${row("ยอดปัจจุบัน", currentFormatted, "var(--foreground)")}
      ${row("อนุมัติแล้วรอลงบัญชี", approvedUnpostedFormatted, "var(--muted-foreground)")}
      <div class="gl-projbal__row-full">
        <div class="gl-projbal__grid-label">รายการนี้</div>
        <div class="num-display" style="font-weight: var(--weight-semibold); color: ${
          projection.evaluatingTransactionImpact.isNegative()
            ? "var(--expense)"
            : "var(--income)"
        };">
          ${evaluatingFormatted}
        </div>
      </div>
    </div>

    <div class="gl-projbal__result${isDeficit ? " gl-projbal__result--deficit" : ""}">
      <span class="gl-projbal__result-label">
        คงเหลือหลังอนุมัติ
      </span>
      <span class="num-display gl-projbal__result-value">
        ${projectedFormatted}
      </span>
    </div>

    ${deficitNoticeHtml}
  </div>
  `;
}
