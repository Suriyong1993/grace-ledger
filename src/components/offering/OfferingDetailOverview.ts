import { Money } from "../../lib/money";
import { escapeHtml } from "../../lib/format";
import { OfferingSession, OfferingItem, OfferingPaymentChannel } from "../../lib/offering/types";
import { formatDateThai } from "../../lib/format";
import { renderOfferingStatusBadge } from "./OfferingSessionList";

export interface OfferingDetailOverviewProps {
  session: OfferingSession;
}

const CHANNEL_LABEL: Record<OfferingPaymentChannel, string> = {
  cash: "เงินสด",
  bank_transfer: "เงินโอน",
  qr_code: "พร้อมเพย์ / QR",
  other: "อื่น ๆ",
};

/** One row of the read-only fact list. Label left, value right, rule underneath. */
function factRow(label: string, value: string, opts: { mono?: boolean; strong?: boolean } = {}): string {
  const valueClass = opts.mono ? "num-display" : "";
  const weight = opts.strong ? "var(--weight-bold)" : "var(--weight-semibold)";
  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-4);
      padding: var(--space-3) 0;
      border-bottom: 1px solid var(--border);
    ">
      <span style="font-size: var(--text-sm); color: var(--muted-foreground);">${label}</span>
      <span class="${valueClass}" style="font-size: var(--text-sm); font-weight: ${weight}; text-align: right;">${value}</span>
    </div>`;
}

function groupItemsByFund(items: OfferingItem[]): Array<{
  fundName: string;
  cash: Money;
  transfer: Money;
  qr: Money;
  total: Money;
}> {
  const map = new Map<string, { fundName: string; cash: Money; transfer: Money; qr: Money; total: Money }>();

  for (const item of items) {
    const key = item.fundId || item.fundName || "unknown";
    const row =
      map.get(key) || {
        fundName: item.fundName || "กองทุน",
        cash: Money.zero(),
        transfer: Money.zero(),
        qr: Money.zero(),
        total: Money.zero(),
      };

    if (item.paymentChannel === "cash") {
      row.cash = row.cash.add(item.amount);
    } else if (item.paymentChannel === "bank_transfer") {
      row.transfer = row.transfer.add(item.amount);
    } else if (item.paymentChannel === "qr_code") {
      row.qr = row.qr.add(item.amount);
    }
    row.total = row.total.add(item.amount);

    map.set(key, row);
  }

  return Array.from(map.values());
}

function renderFundAllocationHtml(items: OfferingItem[]): string {
  const rows = groupItemsByFund(items);

  if (rows.length === 0) {
    return `<p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">ยังไม่มีการจัดสรรเข้ากองทุน</p>`;
  }

  const bodyHtml = rows
    .map(
      (row) => `
      <tr>
        <td class="gl-td-lead">${escapeHtml(row.fundName)}</td>
        <td data-label="เงินสด" class="is-right num-display">${row.cash.format()}</td>
        <td data-label="เงินโอน" class="is-right num-display">${row.transfer.format()}</td>
        <td data-label="QR" class="is-right num-display">${row.qr.format()}</td>
        <td data-label="รวม" class="is-right num-display" style="font-weight: var(--weight-bold);">${row.total.format()}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="gl-card" style="padding: 0; overflow: hidden;">
      <table class="gl-table gl-table--cards">
        <thead>
          <tr>
            <th>กองทุน</th>
            <th class="is-right">เงินสด</th>
            <th class="is-right">เงินโอน</th>
            <th class="is-right">QR</th>
            <th class="is-right">รวม</th>
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>`;
}

interface TimelineEntry {
  label: string;
  detail: string;
  at?: string | null;
}

function renderTimelineHtml(session: OfferingSession): string {
  const entries: TimelineEntry[] = [];

  if (session.createdAt || session.creatorName) {
    entries.push({
      label: "บันทึกยอดถวาย",
      detail: session.creatorName ? `โดย ${session.creatorName}` : "",
      at: session.createdAt,
    });
  }

  for (const rev of session.revisions || []) {
    entries.push({
      label: `แก้ไขยอดครั้งที่ ${rev.revisionNumber}`,
      detail: `${rev.previousTotalAmount.format()} เป็น ${rev.newTotalAmount.format()} · ${rev.revisionReason}`,
      at: rev.createdAt,
    });
  }

  if (session.cashCount) {
    const counters = [session.cashCount.countedBy1Name, session.cashCount.countedBy2Name]
      .filter(Boolean)
      .join(" และ ");
    entries.push({
      label: "ตรวจนับเงินสด",
      detail: counters ? `โดย ${counters}` : "",
      at: session.cashCount.counter1SignedAt || session.cashCount.createdAt,
    });
  }

  if (session.varianceReason) {
    entries.push({ label: "บันทึกคำชี้แจงผลต่าง", detail: escapeHtml(session.varianceReason), at: null });
  }

  if (session.postedAt || session.financialTransactionId) {
    entries.push({
      label: "บันทึกเข้าบัญชี",
      detail: session.financialTransactionId ? `TX: ${session.financialTransactionId.substring(0, 13)}...` : "",
      at: session.postedAt,
    });
  }

  if (entries.length === 0) {
    return `<p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">ยังไม่มีประวัติการดำเนินการ</p>`;
  }

  const rowsHtml = entries
    .map(
      (entry) => `
      <li style="display: flex; gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--border);">
        <span aria-hidden="true" style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border);
          flex-shrink: 0;
          margin-top: 7px;
        "></span>
        <div style="min-width: 0; flex: 1;">
          <div style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">${entry.label}</div>
          ${entry.detail ? `<div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: 2px;">${entry.detail}</div>` : ""}
        </div>
        ${entry.at ? `<span style="font-size: var(--text-xs); color: var(--muted-foreground); white-space: nowrap;">${formatDateThai(entry.at)}</span>` : ""}
      </li>`
    )
    .join("");

  return `<ul class="gl-rows" style="list-style: none; margin: 0; padding: 0;">${rowsHtml}</ul>`;
}

export function renderOfferingDetailOverviewHtml(props: OfferingDetailOverviewProps): string {
  const { session } = props;

  const countedCash = session.cashCount?.totalCashCounted || session.countedCashAmount || null;
  const variance = session.cashVarianceAmount || null;
  const items = session.items || [];

  const channelRows = [
    factRow(CHANNEL_LABEL.cash, session.expectedCashAmount.format(), { mono: true }),
    factRow(CHANNEL_LABEL.bank_transfer, session.expectedTransferAmount.format(), { mono: true }),
    factRow(CHANNEL_LABEL.qr_code, session.expectedQrAmount.format(), { mono: true }),
    factRow("รวมทุกช่องทาง", session.expectedTotalAmount.format(), { mono: true, strong: true }),
  ].join("");

  const countRows = countedCash
    ? [
        factRow("เงินสดที่นับได้", countedCash.format(), { mono: true }),
        variance
          ? factRow("ผลต่างเงินสด", variance.format({ showSign: true }), { mono: true, strong: true })
          : "",
        session.cashCount?.countedBy1Name
          ? factRow("ผู้ตรวจนับคนที่ 1", session.cashCount.countedBy1Name)
          : "",
        session.cashCount?.countedBy2Name
          ? factRow("ผู้ตรวจนับคนที่ 2", session.cashCount.countedBy2Name)
          : "",
      ].join("")
    : "";

  return `
  <div class="gl-offering-overview gl-stack" style="gap: var(--space-8);">
    <section class="gl-section" style="margin: 0;" aria-labelledby="gl-overview-session">
      <div class="gl-section__head">
        <h2 id="gl-overview-session">ข้อมูลรอบนมัสการ</h2>
        ${renderOfferingStatusBadge(session.status)}
      </div>
      <div class="gl-rows">
        ${factRow("วันที่นมัสการ", formatDateThai(session.serviceDate))}
        ${factRow("รอบนมัสการ", escapeHtml(session.serviceName))}
        ${session.creatorName ? factRow("ผู้บันทึก", session.creatorName) : ""}
        ${session.notes ? factRow("หมายเหตุ", session.notes) : ""}
      </div>
    </section>

    <section class="gl-section" style="margin: 0;" aria-labelledby="gl-overview-channels">
      <div class="gl-section__head">
        <h2 id="gl-overview-channels">ยอดตามช่องทาง</h2>
      </div>
      <div class="gl-rows">${channelRows}</div>
    </section>

    <section class="gl-section" style="margin: 0;" aria-labelledby="gl-overview-funds">
      <div class="gl-section__head">
        <h2 id="gl-overview-funds">การจัดสรรเข้ากองทุน</h2>
      </div>
      ${renderFundAllocationHtml(items)}
    </section>

    ${countRows ? `
      <section class="gl-section" style="margin: 0;" aria-labelledby="gl-overview-count">
        <div class="gl-section__head">
          <h2 id="gl-overview-count">ผลการตรวจนับ</h2>
        </div>
        <div class="gl-rows">${countRows}</div>
      </section>
    ` : ""}

    <section class="gl-section" style="margin: 0;" aria-labelledby="gl-overview-timeline">
      <div class="gl-section__head">
        <h2 id="gl-overview-timeline">ประวัติการดำเนินการ</h2>
      </div>
      ${renderTimelineHtml(session)}
    </section>
  </div>
  `;
}
