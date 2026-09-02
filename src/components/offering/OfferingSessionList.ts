import { OfferingSession, OfferingSessionStatus } from "../../lib/offering/types";
import { escapeHtml } from "../../lib/format";
import { formatDateThai } from "../../lib/format";

export interface OfferingSessionListProps {
  sessions: OfferingSession[];
  isLoading: boolean;
  errorMessage: string | null;
  onNewSessionClick?: () => void;
}

const ICON_CHEVRON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><polyline points="9 18 15 12 9 6"/></svg>`;
const ICON_CHECK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_CARD = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 10h20"/></svg>`;

const STATUS_BADGE: Record<
  OfferingSessionStatus,
  { label: string; variant: string; dot: string }
> = {
  draft: { label: "ร่าง", variant: "neutral", dot: "var(--muted-foreground)" },
  counting: { label: "กำลังนับเงิน", variant: "pending", dot: "var(--primary)" },
  counted: { label: "นับเงินแล้ว", variant: "info", dot: "var(--info)" },
  variance_review: { label: "ตรวจสอบผลต่าง", variant: "pending", dot: "var(--pending)" },
  confirmed: { label: "ยืนยันแล้ว", variant: "approved", dot: "var(--income)" },
  posted: { label: "ลงบัญชีแล้ว", variant: "approved", dot: "" },
  voided: { label: "ยกเลิก", variant: "neutral", dot: "" },
};

export function renderOfferingStatusBadge(status: OfferingSessionStatus): string {
  const config = STATUS_BADGE[status];
  if (!config) {
    return `<span class="gl-badge gl-badge--neutral">${status}</span>`;
  }
  const lead =
    status === "posted"
      ? ICON_CHECK
      : config.dot
        ? `<span aria-hidden="true" style="width: 6px; height: 6px; border-radius: 50%; background: ${config.dot};"></span>`
        : "";
  const extra = status === "voided" ? ' style="text-decoration: line-through;"' : "";
  return `<span class="gl-badge gl-badge--${config.variant}"${extra}>${lead}${config.label}</span>`;
}

export function renderOfferingSessionListHtml(props: OfferingSessionListProps): string {
  const { sessions, isLoading, errorMessage } = props;

  if (isLoading) {
    return `
    <div class="gl-page gl-offering-list-container gl-fade-in" aria-busy="true" aria-live="polite">
      <span class="gl-visually-hidden">กำลังโหลดรายการเงินถวาย</span>
      <div class="gl-stack">
        <div class="gl-skeleton" style="height: 32px; width: 220px;"></div>
        <div class="gl-skeleton" style="height: 64px;"></div>
        <div class="gl-skeleton" style="height: 64px;"></div>
        <div class="gl-skeleton" style="height: 64px;"></div>
      </div>
    </div>
    `;
  }

  if (errorMessage) {
    return `
    <div class="gl-page gl-offering-list-container gl-fade-in">
      <div class="gl-notice gl-notice--error" role="alert">
        <div class="gl-notice__body">
          <strong>โหลดรายการเงินถวายไม่สำเร็จ</strong>
          <div style="margin-top: var(--space-1);">${errorMessage}</div>
        </div>
        <button type="button" id="gl-btn-retry-sessions" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
      </div>
    </div>
    `;
  }

  const emptyHtml = `
    <div class="gl-card" style="padding: var(--space-12) var(--space-5); text-align: center;">
      <div aria-hidden="true" style="
        width: 48px;
        height: 48px;
        border-radius: var(--radius-full);
        background: var(--accent);
        color: var(--primary);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--space-4);
      ">${ICON_CARD}</div>
      <h2 style="font-size: var(--text-lg); font-weight: var(--weight-semibold); margin: 0 0 var(--space-1);">
        ยังไม่มีรายการบันทึกเงินถวาย
      </h2>
      <p style="font-size: var(--text-sm); color: var(--muted-foreground); max-width: 360px; margin: 0 auto var(--space-5);">
        เริ่มบันทึกยอดรอบนมัสการแรกเพื่อส่งตรวจนับ
      </p>
      <a href="#/offerings/new" class="gl-btn gl-btn--primary">+ บันทึกเงินถวายรอบแรก</a>
    </div>`;

  const rowsHtml = sessions
    .map((s) => {
      const totalTransferAndQr = s.expectedTransferAmount.add(s.expectedQrAmount);
      const actionLabel = s.status === "draft" ? "เปิดต่อ" : "ดูรายละเอียด";
      return `
      <tr class="gl-offering-row">
        <td class="gl-td-lead">
          <div style="font-weight: var(--weight-semibold); color: var(--foreground);">
            ${formatDateThai(s.serviceDate)}
          </div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: 2px;">
            ${escapeHtml(s.serviceName)}
          </div>
        </td>
        <td data-label="สถานะ">
          ${renderOfferingStatusBadge(s.status)}
        </td>
        <td data-label="เงินสด" class="is-right num-display">
          ${s.expectedCashAmount.format()}
        </td>
        <td data-label="โอน / QR" class="is-right num-display" style="color: var(--muted-foreground);">
          ${totalTransferAndQr.format()}
        </td>
        <td data-label="ยอดรวม" class="is-right num-display" style="font-weight: var(--weight-bold);">
          ${s.expectedTotalAmount.format()}
        </td>
        <td class="is-right gl-td-actions">
          <a href="#/offerings/${s.id}" class="gl-btn-view-session gl-btn gl-btn--secondary gl-btn--sm">
            <span>${actionLabel}</span>
            ${ICON_CHEVRON}
          </a>
        </td>
      </tr>`;
    })
    .join("");

  const tableHtml = `
    <div class="gl-card" style="padding: 0; overflow: hidden;">
      <table class="gl-table gl-table--cards">
        <thead>
          <tr>
            <th>วันที่ / รอบนมัสการ</th>
            <th>สถานะ</th>
            <th class="is-right">เงินสด</th>
            <th class="is-right">โอน / QR</th>
            <th class="is-right">ยอดรวม</th>
            <th class="is-right"><span class="gl-visually-hidden">การจัดการ</span></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;

  return `
  <div class="gl-page gl-offering-list-container gl-fade-in">
    <div class="gl-page-header" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: var(--space-4);">
      <div>
        <h1>เงินถวายวันอาทิตย์</h1>
        <p>บันทึกยอดแยกช่องทาง แล้วตรวจนับด้วยผู้ตรวจ 2 คน</p>
      </div>
      <a href="#/offerings/new" id="btn-create-offering" class="gl-btn gl-btn--primary">+ บันทึกเงินถวาย</a>
    </div>

    ${sessions.length === 0 ? emptyHtml : tableHtml}
  </div>
  `;
}
