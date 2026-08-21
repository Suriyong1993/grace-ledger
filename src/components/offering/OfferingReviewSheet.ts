import { Money } from "../../lib/money";
import { FundOption, OfferingEntryFormState } from "./OfferingEntryForm";
import { formatDateThai } from "../../lib/format";

export interface OfferingReviewSheetProps {
  funds: FundOption[];
  state: OfferingEntryFormState;
  creatorName?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export function renderOfferingReviewSheetHtml(props: OfferingReviewSheetProps): string {
  const { funds, state, creatorName = "ศจ.สมชาย มีสุข", isSubmitting = false, errorMessage } = props;

  const grandExpected = state.channels.cash.add(state.channels.transfer).add(state.channels.qr);

  // Group allocations by Fund
  const fundMap = new Map<string, { name: string; cash: Money; transfer: Money; qr: Money; total: Money; items: typeof state.allocations }>();

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
      const fundName = funds.find((item) => item.id === alloc.fundId)?.name || "กองทุนทั่วไป";
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
  const activeFundAllocations = Array.from(fundMap.values()).filter((f) => !f.total.isZero());

  return `
  <div class="gl-offering-review-container gl-fade-in" style="padding: 28px 32px 64px; max-width: 960px; margin: 0 auto;">
    <!-- Breadcrumb & Step -->
    <div style="margin-bottom: 20px;">
      <button type="button" id="btn-back-to-entry" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--muted-foreground);
        background: none;
        border: none;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        padding: 0;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>ย้อนกลับไปแก้ไขข้อมูล</span>
      </button>
    </div>

    <!-- Header & Step Indicator -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--income); color: #ffffff; font-size: 12px; font-weight: 700;">
            ✓
          </span>
          <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--income);">ขั้นตอนที่ 2 / 2: ตรวจทานยอดและยืนยันบันทึกร่าง
          </span>
        </div>
        <h1 style="font-size: 24px; font-weight: 800; color: var(--foreground); margin: 0; letter-spacing: -0.02em;">ตรวจทานรายการเงินถวาย
        </h1>
      </div>

    </div>

    <!-- Error Banner if any -->
    ${errorMessage ? `
      <div style="background: var(--expense-muted); border: 1px solid var(--expense); border-radius: var(--radius-md, 10px); padding: 14px 18px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; color: var(--expense); font-weight: 700; font-size: 13.5px; margin-bottom: 4px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>ไม่สามารถบันทึกข้อมูลได้</span>
        </div>
        <p style="margin: 0; color: var(--on-expense-muted); font-size: 13px;">${errorMessage}</p>
      </div>
    ` : ""}

    <!-- Summary Box 1: Session Meta Header -->
    <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 22px 24px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div>
          <div style="font-size: 12px; color: var(--muted-foreground); margin-bottom: 2px;">วันที่นมัสการ</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--foreground);">
            ${formatDateThai(state.serviceDate)}
          </div>
        </div>

        <div>
          <div style="font-size: 12px; color: var(--muted-foreground); margin-bottom: 2px;">รอบการนมัสการ</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--foreground);">
            ${state.serviceName}
          </div>
        </div>

        <div>
          <div style="font-size: 12px; color: var(--muted-foreground); margin-bottom: 2px;">ผู้บันทึกข้อมูล</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--foreground);">
            ${creatorName}
          </div>
        </div>

        <div>
          <div style="font-size: 12px; color: var(--muted-foreground); margin-bottom: 2px;">สถานะเริ่มต้น</div>
          <div>
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 600; background: var(--muted); color: var(--muted-foreground); border: 1px solid var(--border);">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--muted-foreground);"></span> ร่าง
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Box 2: Channel Grand Totals Cards -->
    <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 22px 24px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
      <h3 style="font-size: 15px; font-weight: 700; color: var(--foreground); margin: 0 0 16px 0;">สรุปยอดที่คาดหวังแยกตามช่องทาง
      </h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 16px;">
        <!-- Cash Card -->
        <div style="background: var(--income-muted); border: 1px solid var(--approved); border-radius: var(--radius-md, 10px); padding: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: var(--on-income-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">เงินสด (จะส่งนับจริง)
          </div>
          <div class="num-display" style="font-size: 20px; font-weight: 800; color: var(--on-income-muted);">
            ${state.channels.cash.format()}
          </div>
          <div style="font-size: 11.5px; color: var(--on-income-muted); margin-top: 4px;">บันทึกเข้า: ตู้เซฟ/เงินสดในมือ
          </div>
        </div>

        <!-- Transfer Card -->
        <div style="background: var(--secondary); border: 1px solid var(--border); border-radius: var(--radius-md, 10px); padding: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: var(--on-info-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">เงินโอนผ่านธนาคาร
          </div>
          <div class="num-display" style="font-size: 20px; font-weight: 800; color: var(--on-info-muted);">
            ${state.channels.transfer.format()}
          </div>
          <div style="font-size: 11.5px; color: var(--on-info-muted); margin-top: 4px;">บันทึกเข้า: บัญชีธนาคาร
          </div>
        </div>

        <!-- QR Card -->
        <div style="background: var(--pending-muted); border: 1px solid var(--pending); border-radius: var(--radius-md, 10px); padding: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: var(--on-pending-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">พร้อมเพย์ / QR Code
          </div>
          <div class="num-display" style="font-size: 20px; font-weight: 800; color: var(--on-pending-muted);">
            ${state.channels.qr.format()}
          </div>
          <div style="font-size: 11.5px; color: var(--on-pending-muted); margin-top: 4px;">บันทึกเข้า: บัญชีธนาคาร
          </div>
        </div>

        <!-- Grand Total Card -->
        <div style="background: var(--gl-orange-50); border: 1px solid var(--primary); border-radius: var(--radius-md, 10px); padding: 16px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--gl-orange-900); margin-bottom: 4px;">ยอดรวมทั้งสิ้น
          </div>
          <div class="num-display" style="font-size: 22px; font-weight: 900; color: var(--primary);">
            ${grandExpected.format()}
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Box 3: Fund Allocation Breakdown Table -->
    <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); overflow: hidden; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--gl-stone-50);">
        <h3 style="font-size: 14px; font-weight: 700; color: var(--foreground); margin: 0;">ตารางการจัดสรรเข้ากองทุน
        </h3>
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
          ${activeFundAllocations.map((f) => `
            <tr>
              <td class="gl-td-lead" style="font-weight: var(--weight-semibold);">${f.name}</td>
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
          `).join("")}
        </tbody>
        <tfoot>
          <tr style="background: var(--secondary); font-weight: var(--weight-bold);">
            <td class="gl-td-lead">รวมทั้งหมด</td>
            <td data-label="เงินสด" class="is-right num-display" style="color: var(--on-income-muted);">
              ${state.channels.cash.format()}
            </td>
            <td data-label="เงินโอน" class="is-right num-display" style="color: var(--on-info-muted);">
              ${state.channels.transfer.format()}
            </td>
            <td data-label="QR Code" class="is-right num-display" style="color: var(--on-pending-muted);">
              ${state.channels.qr.format()}
            </td>
            <td data-label="ยอดรวมทั้งหมด" class="is-right num-display" style="color: var(--primary);">
              ${grandExpected.format()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Notes if any -->
    ${state.notes ? `
      <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 600; color: var(--muted-foreground); margin-bottom: 4px;">หมายเหตุ</div>
        <div style="font-size: 13.5px; color: var(--foreground); white-space: pre-wrap;">${state.notes}</div>
      </div>
    ` : ""}

    <!-- Action Buttons -->
    <div class="gl-actionbar gl-actionbar--sticky">
      <button
        type="button"
        id="btn-back-to-edit"
        style="
          padding: 10px 20px;
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--foreground);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        "
        ${isSubmitting ? "disabled" : ""}
      >
        ← ย้อนกลับแก้ไข
      </button>

      <button
        type="button"
        id="btn-confirm-save-draft"
        style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 28px;
          border-radius: var(--radius-md, 10px);
          border: none;
          background: ${isSubmitting ? 'var(--muted-foreground)' : 'var(--primary)'};
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          cursor: ${isSubmitting ? 'not-allowed' : 'pointer'};
          box-shadow: 0 1px 3px rgba(249, 115, 22, 0.3);
        "
        ${isSubmitting ? "disabled" : ""}
      >
        ${isSubmitting ? `
          <svg class="gl-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
          <span>กำลังบันทึกลงฐานข้อมูล...</span>
        ` : `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>ยืนยันและบันทึกร่าง</span>
        `}
      </button>
    </div>
  </div>
  `;
}

