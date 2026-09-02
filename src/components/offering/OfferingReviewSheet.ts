import { Money } from "../../lib/money";
import { escapeHtml } from "../../lib/format";
import { FundOption, OfferingEntryFormState } from "./OfferingEntryForm";
import { formatDateThai } from "../../lib/format";

export interface OfferingReviewSheetProps {
  funds: FundOption[];
  state: OfferingEntryFormState;
  creatorName?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export function renderOfferingReviewSheetHtml(
  props: OfferingReviewSheetProps,
): string {
  const {
    funds,
    state,
    creatorName = "ศจ.สมชาย มีสุข",
    isSubmitting = false,
    errorMessage,
  } = props;

  const grandExpected = state.channels.cash
    .add(state.channels.transfer)
    .add(state.channels.qr);

  // Group allocations by Fund
  const fundMap = new Map<
    string,
    {
      name: string;
      cash: Money;
      transfer: Money;
      qr: Money;
      total: Money;
      items: typeof state.allocations;
    }
  >();

  for (const fund of funds) {
    fundMap.set(fund.id, {
      name: fund.name,
      cash: Money.zero(),
      transfer: Money.zero(),
      qr: Money.zero(),
      total: Money.zero(),
      items: [],
    });
  }

  for (const alloc of state.allocations) {
    let f = fundMap.get(alloc.fundId);
    if (!f) {
      const fundName =
        funds.find((item) => item.id === alloc.fundId)?.name || "กองทุนทั่วไป";
      f = {
        name: fundName,
        cash: Money.zero(),
        transfer: Money.zero(),
        qr: Money.zero(),
        total: Money.zero(),
        items: [],
      };
      fundMap.set(alloc.fundId, f);
    }

    if (alloc.channel === "cash") {
      f.cash = f.cash.add(alloc.amount);
    } else if (alloc.channel === "bank_transfer") {
      f.transfer = f.transfer.add(alloc.amount);
    } else if (alloc.channel === "qr_code") {
      f.qr = f.qr.add(alloc.amount);
    }
    f.total = f.total.add(alloc.amount);
    f.items.push(alloc);
  }

  // Active funds with non-zero allocations
  const activeFundAllocations = Array.from(fundMap.values()).filter(
    (f) => !f.total.isZero(),
  );

  return `
  <div class="gl-page gl-offering-review-container gl-fade-in">
    <!-- Breadcrumb & Step -->
    <div style="margin-bottom: var(--space-5);">
      <button type="button" id="btn-back-to-entry" class="gl-offering-backlink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>ย้อนกลับไปแก้ไขข้อมูล</span>
      </button>
    </div>

    <!-- Header & Step Indicator -->
    <div class="gl-page-header">
      <div class="gl-offering-step">
        <span class="gl-offering-step__badge" style="background: var(--income); color: var(--income-foreground);" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"><polyline points="20 6 9 17 4 12"/></svg></span>
        <span class="gl-offering-step__label" style="color: var(--income);">ขั้นตอนที่ 2 / 2: ตรวจทานยอดและยืนยันบันทึกร่าง</span>
      </div>
      <h1>ตรวจทานรายการเงินถวาย</h1>
    </div>

    <!-- Error Banner if any -->
    ${
      errorMessage
        ? `
      <div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-5); flex-direction: column; align-items: stretch;">
        <div class="gl-notice__body" style="display: flex; align-items: center; gap: var(--space-2); font-weight: var(--weight-bold);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>ไม่สามารถบันทึกข้อมูลได้</span>
        </div>
        <p style="margin: var(--space-1) 0 0;">${errorMessage}</p>
      </div>
    `
        : ""
    }

    <!-- Session Meta Header -->
    <div class="gl-card" style="margin-bottom: var(--space-5);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4);">
        <div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-bottom: 2px;">วันที่นมัสการ</div>
          <div style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground);">${formatDateThai(state.serviceDate)}</div>
        </div>

        <div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-bottom: 2px;">รอบการนมัสการ</div>
          <div style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground);">${escapeHtml(state.serviceName)}</div>
        </div>

        <div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-bottom: 2px;">ผู้บันทึกข้อมูล</div>
          <div style="font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--foreground);">${creatorName}</div>
        </div>

        <div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-bottom: 2px;">สถานะเริ่มต้น</div>
          <span class="gl-badge gl-badge--neutral">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--muted-foreground);"></span> ร่าง
          </span>
        </div>
      </div>
    </div>

    <!-- Channel Grand Totals -->
    <div class="gl-card" style="margin-bottom: var(--space-5);">
      <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground); margin: 0 0 var(--space-4);">สรุปยอดที่คาดหวังแยกตามช่องทาง</h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3);">
        <!-- Cash -->
        <div class="gl-offering-chip" style="background: var(--income-muted); border-color: var(--approved);">
          <div style="font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--on-income-muted); margin-bottom: var(--space-1);">เงินสด (จะส่งนับจริง)</div>
          <div class="num-display" style="font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--on-income-muted);">${state.channels.cash.format()}</div>
          <div style="font-size: var(--text-xs); color: var(--on-income-muted); margin-top: var(--space-1);">บันทึกเข้า: ตู้เซฟ/เงินสดในมือ</div>
        </div>

        <!-- Transfer -->
        <div class="gl-offering-chip" style="background: var(--secondary);">
          <div style="font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--on-info-muted); margin-bottom: var(--space-1);">เงินโอนผ่านธนาคาร</div>
          <div class="num-display" style="font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--on-info-muted);">${state.channels.transfer.format()}</div>
          <div style="font-size: var(--text-xs); color: var(--on-info-muted); margin-top: var(--space-1);">บันทึกเข้า: บัญชีธนาคาร</div>
        </div>

        <!-- QR -->
        <div class="gl-offering-chip" style="background: var(--pending-muted); border-color: var(--pending);">
          <div style="font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--on-pending-muted); margin-bottom: var(--space-1);">พร้อมเพย์ / QR Code</div>
          <div class="num-display" style="font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--on-pending-muted);">${state.channels.qr.format()}</div>
          <div style="font-size: var(--text-xs); color: var(--on-pending-muted); margin-top: var(--space-1);">บันทึกเข้า: บัญชีธนาคาร</div>
        </div>

        <!-- Grand Total — the figure this screen exists to confirm, one weight class above its three parts. -->
        <div class="gl-offering-chip" style="background: var(--accent); border-color: var(--primary);">
          <div style="font-size: var(--text-xs); font-weight: var(--weight-bold); color: var(--accent-foreground); margin-bottom: var(--space-1);">ยอดรวมทั้งสิ้น</div>
          <div class="num-display" style="font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--primary);">${grandExpected.format()}</div>
        </div>
      </div>
    </div>

    <!-- Fund Allocation Breakdown Table -->
    <div class="gl-card" style="padding: 0; overflow: hidden; margin-bottom: var(--space-5);">
      <div style="padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); background: var(--secondary);">
        <h3 style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--foreground); margin: 0;">ตารางการจัดสรรเข้ากองทุน</h3>
      </div>

      <table class="gl-table gl-table--cards">
        <thead>
          <tr>
            <th>กองทุน</th>
            <th class="is-right">เงินสด</th>
            <th class="is-right">เงินโอน</th>
            <th class="is-right">QR Code</th>
            <th class="is-right">ยอดรวมกองทุน</th>
          </tr>
        </thead>
        <tbody>
          ${activeFundAllocations
            .map(
              (f) => `
            <tr>
              <td class="gl-td-lead" style="font-weight: var(--weight-semibold);">${escapeHtml(f.name)}</td>
              <td data-label="เงินสด" class="is-right num-display">
                ${!f.cash.isZero() ? f.cash.format() : '<span style="color: var(--muted-foreground);">-</span>'}
              </td>
              <td data-label="เงินโอน" class="is-right num-display">
                ${!f.transfer.isZero() ? f.transfer.format() : '<span style="color: var(--muted-foreground);">-</span>'}
              </td>
              <td data-label="QR Code" class="is-right num-display">
                ${!f.qr.isZero() ? f.qr.format() : '<span style="color: var(--muted-foreground);">-</span>'}
              </td>
              <td data-label="ยอดรวมกองทุน" class="is-right num-display" style="font-weight: var(--weight-bold);">
                ${f.total.format()}
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr style="background: var(--secondary); font-weight: var(--weight-bold);">
            <td class="gl-td-lead">รวมทั้งหมด</td>
            <td data-label="เงินสด" class="is-right num-display" style="color: var(--on-income-muted);">${state.channels.cash.format()}</td>
            <td data-label="เงินโอน" class="is-right num-display" style="color: var(--on-info-muted);">${state.channels.transfer.format()}</td>
            <td data-label="QR Code" class="is-right num-display" style="color: var(--on-pending-muted);">${state.channels.qr.format()}</td>
            <td data-label="ยอดรวมทั้งหมด" class="is-right num-display" style="color: var(--primary);">${grandExpected.format()}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Notes if any -->
    ${
      state.notes
        ? `
      <div class="gl-card" style="margin-bottom: var(--space-6);">
        <div style="font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--muted-foreground); margin-bottom: var(--space-1);">หมายเหตุ</div>
        <div style="font-size: var(--text-sm); color: var(--foreground); white-space: pre-wrap;">${state.notes}</div>
      </div>
    `
        : ""
    }

    <!-- Action Buttons -->
    <div class="gl-actionbar gl-actionbar--sticky">
      <button type="button" id="btn-back-to-edit" class="gl-btn gl-btn--secondary" ${isSubmitting ? "disabled" : ""}>
        ← ย้อนกลับแก้ไข
      </button>

      <button type="button" id="btn-confirm-save-draft" class="gl-btn gl-btn--primary" ${isSubmitting ? "disabled" : ""}>
        ${
          isSubmitting
            ? `
          <svg class="gl-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
          <span>กำลังบันทึกลงฐานข้อมูล...</span>
        `
            : `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>ยืนยันและบันทึกร่าง</span>
        `
        }
      </button>
    </div>
  </div>
  `;
}
