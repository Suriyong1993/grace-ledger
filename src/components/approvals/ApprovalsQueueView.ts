import { PendingApprovalItem } from "../../lib/transactions/types";
import { Money } from "../../lib/money";
import { renderStatusBadgeHtml } from "./StatusBadge";

export interface ApprovalsQueueViewProps {
  items: PendingApprovalItem[];
  selectedId?: string | null;
  isLoading?: boolean;
  errorMessage?: string | null;
}

const ICON_CHEVRON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m9 18 6-6-6-6"/></svg>`;

function renderHeaderHtml(totalCount: number, formattedTotal: string): string {
  return `
    <div class="gl-section__head" style="align-items: flex-end; margin-bottom: var(--space-5);">
      <div>
        <h1 style="font-size: var(--text-3xl); font-weight: var(--weight-bold); margin: 0;">คิวอนุมัติ</h1>
        <p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: var(--space-1) 0 0;">
          ตรวจยอด ใบเสร็จ และผลกระทบต่อกองทุนก่อนอนุมัติ
        </p>
      </div>
      <div style="text-align: right; white-space: nowrap;">
        <div style="font-size: var(--text-xs); color: var(--muted-foreground);">รอดำเนินการ ${totalCount} รายการ</div>
        <div class="num-display" style="font-size: var(--text-xl); font-weight: var(--weight-bold);">
          ${formattedTotal}
        </div>
      </div>
    </div>`;
}

export function renderApprovalsQueueViewHtml(props: ApprovalsQueueViewProps): string {
  const { items, isLoading, errorMessage } = props;

  const totalCount = items.length;
  const totalAmount = items.reduce((sum, item) => sum.add(item.amount), Money.zero());
  const formattedTotal = totalAmount ? totalAmount.format({ currency: "THB" }) : "฿0.00";

  if (isLoading) {
    return `
    <div class="gl-approvals-queue-loading gl-stack" aria-busy="true" aria-live="polite">
      <span class="gl-visually-hidden">กำลังโหลดคิวอนุมัติ</span>
      <div class="gl-skeleton" style="height: 32px; width: 200px;"></div>
      <div class="gl-skeleton" style="height: 84px;"></div>
      <div class="gl-skeleton" style="height: 84px;"></div>
      <div class="gl-skeleton" style="height: 84px;"></div>
    </div>
    `;
  }

  if (errorMessage) {
    return `
    <div class="gl-approvals-queue-error gl-notice gl-notice--error" role="alert">
      <div class="gl-notice__body">
        <strong>โหลดคิวอนุมัติไม่สำเร็จ</strong>
        <div style="margin-top: var(--space-1);">${errorMessage}</div>
      </div>
      <button type="button" class="gl-btn-retry gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
    </div>
    `;
  }

  if (items.length === 0) {
    return `
    <div class="gl-approvals-queue-empty gl-card" style="text-align: center; padding: var(--space-12) var(--space-5);">
      <h2 style="font-size: var(--text-lg); font-weight: var(--weight-semibold); margin: 0 0 var(--space-1);">
        ไม่มีรายการค้างอนุมัติ
      </h2>
      <p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">
        รายการที่ส่งมาขออนุมัติจะแสดงที่นี่
      </p>
    </div>
    `;
  }

  const itemsHtml = items
    .map((item) => {
      const sign = item.direction === "expense" ? "−" : item.direction === "income" ? "+" : "";
      const formattedItemAmount = `${sign}${item.amount.format({ currency: "THB", showSign: false })}`;
      const statusBadge = renderStatusBadgeHtml({ status: item.status });
      const fundName = item.splits?.[0]?.fundName || "กองทุนทั่วไป";

      const receiptBadge = item.hasReceipt
        ? ""
        : `<span class="gl-badge gl-badge--pending">ไม่มีใบเสร็จ</span>`;

      const creatorChip = item.isCreator
        ? `<span class="gl-badge gl-badge--neutral">คุณเป็นผู้สร้าง</span>`
        : "";

      return `
      <a class="gl-approval-item gl-card" href="#/approvals/${item.id}" data-id="${item.id}" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        color: inherit;
        text-decoration: none;
      ">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-1);">
            ${statusBadge}
            ${receiptBadge}
            ${creatorChip}
            <span style="font-size: var(--text-xs); color: var(--muted-foreground);">
              ${item.referenceNumber || ""}
            </span>
          </div>
          <div style="font-size: var(--text-base); font-weight: var(--weight-semibold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${item.description}
          </div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: 2px;">
            ${fundName} · ${item.creatorName}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <div style="text-align: right;">
            <div class="num-display" style="
              font-size: var(--text-lg);
              font-weight: var(--weight-bold);
              color: ${item.direction === "expense" ? "var(--expense)" : "var(--income)"};
            ">
              ${formattedItemAmount}
            </div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground);">
              ${item.accountName}
            </div>
          </div>
          <span class="gl-btn-open-decision" data-id="${item.id}" style="color: var(--muted-foreground); display: inline-flex;">
            <span class="gl-visually-hidden">ดูรายละเอียด</span>
            ${ICON_CHEVRON}
          </span>
        </div>
      </a>
      `;
    })
    .join("");

  return `
  <div class="gl-approvals-queue-view">
    ${renderHeaderHtml(totalCount, formattedTotal)}
    <div class="gl-queue-list gl-stack">
      ${itemsHtml}
    </div>
  </div>
  `;
}
