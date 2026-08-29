import { Money } from "../../lib/money";
import { escapeHtml } from "../../lib/format";
import { OfferingPaymentChannel, OfferingSourceType } from "../../lib/offering/types";

export interface FundOption {
  id: string;
  name: string;
  description?: string | null;
  currentBalance?: string;
}

export interface ChannelAmountsState {
  cash: Money;
  transfer: Money;
  qr: Money;
}

export interface AllocationItemState {
  id: string; // unique row id for UI tracking
  fundId: string;
  channel: OfferingPaymentChannel;
  sourceType: OfferingSourceType;
  amount: Money;
  donorName?: string;
  notes?: string;
}

export interface OfferingEntryFormState {
  serviceDate: string;
  serviceName: string;
  channels: ChannelAmountsState;
  allocations: AllocationItemState[];
  notes?: string;
}

export interface OfferingEntryFormProps {
  funds: FundOption[];
  state: OfferingEntryFormState;
  validationErrors?: string[];
}

export function renderOfferingEntryFormHtml(props: OfferingEntryFormProps): string {
  const { funds, state, validationErrors = [] } = props;

  const grandExpected = state.channels.cash.add(state.channels.transfer).add(state.channels.qr);

  // Sum allocations by channel
  const allocCash = state.allocations
    .filter((a) => a.channel === "cash")
    .reduce((acc, a) => acc.add(a.amount), Money.zero());

  const allocTransfer = state.allocations
    .filter((a) => a.channel === "bank_transfer")
    .reduce((acc, a) => acc.add(a.amount), Money.zero());

  const allocQr = state.allocations
    .filter((a) => a.channel === "qr_code")
    .reduce((acc, a) => acc.add(a.amount), Money.zero());

  const totalAllocated = allocCash.add(allocTransfer).add(allocQr);

  // Channel balance checks
  const diffCash = allocCash.subtract(state.channels.cash);
  const diffTransfer = allocTransfer.subtract(state.channels.transfer);
  const diffQr = allocQr.subtract(state.channels.qr);

  const isCashMatch = diffCash.isZero();
  const isTransferMatch = diffTransfer.isZero();
  const isQrMatch = diffQr.isZero();
  const isAllAllocMatched = isCashMatch && isTransferMatch && isQrMatch && !grandExpected.isZero();

  return `
  <div class="gl-page gl-offering-entry-container gl-fade-in">
    <!-- Breadcrumb & Back -->
    <div style="margin-bottom: 20px;">
      <a href="#/offerings" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--muted-foreground);
        text-decoration: none;
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>กลับไปหน้ารายการ</span>
      </a>
    </div>

    <!-- Header & Step Indicator -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--primary); color: var(--primary-foreground); font-size: var(--text-xs); font-weight: var(--weight-bold);">
            1
          </span>
          <span style="font-size: var(--text-xs); font-weight: var(--weight-semibold); text-transform: uppercase; letter-spacing: 0.04em; color: var(--primary);">ขั้นตอนที่ 1 / 2: บันทึกข้อมูลและจัดสรรยอด
          </span>
        </div>
        <h1 style="font-size: 24px; font-weight: var(--weight-bold); color: var(--foreground); margin: 0; letter-spacing: -0.02em;">บันทึกยอดเงินถวายวันอาทิตย์
        </h1>
      </div>

    </div>

    <!-- Validation Errors Banner if any -->
    ${validationErrors.length > 0 ? `
      <div style="background: var(--expense-muted); border: 1px solid var(--expense); border-radius: var(--radius-md, 10px); padding: 14px 18px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; color: var(--expense); font-weight: var(--weight-bold); font-size: 13.5px; margin-bottom: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>กรุณาตรวจสอบข้อมูลก่อนดำเนินการ</span>
        </div>
        <ul style="margin: 0; padding-left: 20px; color: var(--on-expense-muted); font-size: var(--text-sm); line-height: 1.5;">
          ${validationErrors.map((err) => `<li>${err}</li>`).join("")}
        </ul>
      </div>
    ` : ""}

    <!-- Form Body -->
    <form id="offering-entry-form" onsubmit="return false;">
      <!-- Card 1: Service Details -->
      <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 22px 24px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground); margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>ข้อมูลรอบนมัสการ</span>
        </h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
          <div>
            <label for="input-service-date" style="display: block; font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--foreground); margin-bottom: 6px;">วันที่นมัสการ <span style="color: var(--destructive);">*</span>
            </label>
            <input
              type="date"
              id="input-service-date"
              name="serviceDate"
              value="${state.serviceDate}"
              required
              style="
                width: 100%;
                padding: 9px 12px;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm, 8px);
                background: var(--gl-white);
                font-size: 13.5px;
                color: var(--foreground);
              "
            />
          </div>

          <div>
            <label for="input-service-name" style="display: block; font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--foreground); margin-bottom: 6px;">ชื่อรอบการนมัสการ <span style="color: var(--destructive);">*</span>
            </label>
            <select
              id="input-service-name"
              name="serviceName"
              style="
                width: 100%;
                padding: 9px 12px;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm, 8px);
                background: var(--gl-white);
                font-size: 13.5px;
                color: var(--foreground);
              "
            >
              <option value="รอบนมัสการวันอาทิตย์ (เช้า)" ${state.serviceName === "รอบนมัสการวันอาทิตย์ (เช้า)" ? "selected" : ""}>รอบนมัสการวันอาทิตย์ (เช้า)</option>
              <option value="รอบนมัสการวันอาทิตย์ (บ่าย)" ${state.serviceName === "รอบนมัสการวันอาทิตย์ (บ่าย)" ? "selected" : ""}>รอบนมัสการวันอาทิตย์ (บ่าย)</option>
              <option value="รอบนมัสการภาษาอังกฤษ" ${state.serviceName === "รอบนมัสการภาษาอังกฤษ" ? "selected" : ""}>รอบนมัสการภาษาอังกฤษ</option>
              <option value="รอบนมัสการเยาวชน" ${state.serviceName === "รอบนมัสการเยาวชน" ? "selected" : ""}>รอบนมัสการเยาวชน</option>
              <option value="รอบพิเศษ / คริสต์มาส / อีสเตอร์" ${state.serviceName === "รอบพิเศษ / คริสต์มาส / อีสเตอร์" ? "selected" : ""}>รอบพิเศษ / เทศกาล</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Expected totals by channel -->
      <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 22px 24px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground); margin: 0 0 2px 0; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
              <span>1. ยอดรวมตามช่องทาง</span>
            </h3>
            <p style="font-size: 12.5px; color: var(--muted-foreground); margin: 0;">ระบุยอดเงินรวมที่บันทึกได้จากซอง/สลิปของแต่ละช่องทาง
            </p>
          </div>

          <div style="text-align: right;">
            <span style="font-size: var(--text-xs); color: var(--muted-foreground);">ยอดรวมที่คาดหวังทั้งหมด: </span>
            <span class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-bold); color: var(--primary); margin-left: 4px;">
              ${grandExpected.format()}
            </span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
          <!-- Cash Expected -->
          <div style="background: var(--gl-stone-50); border: 1px solid var(--border); border-radius: var(--radius-md, 10px); padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--foreground); display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--income);"></span>เงินสด
              </span>
              <span style="font-size: var(--text-2xs); font-weight: var(--weight-semibold); padding: 1px 6px; border-radius: 4px; background: var(--income-muted); color: var(--on-income-muted);">ส่งตรวจนับ
              </span>
            </div>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 10px; font-weight: var(--weight-bold); color: var(--muted-foreground); font-size: 14px;">฿</span>
              <input
                type="number"
                step="0.01"
                min="0"
                id="input-expected-cash"
                name="expectedCash"
                value="${state.channels.cash.toNumber() > 0 ? state.channels.cash.toNumber() : ""}"
                placeholder="0.00"
                class="num-display"
                style="
                  width: 100%;
                  padding: 9px 12px 9px 30px;
                  border: 1px solid var(--border);
                  border-radius: var(--radius-sm, 8px);
                  background: var(--gl-white);
                  font-size: var(--text-base);
                  font-weight: var(--weight-bold);
                  color: var(--foreground);
                  text-align: right;
                "
              />
            </div>
            <div style="font-size: 11.5px; color: var(--muted-foreground); margin-top: 6px; display: flex; justify-content: space-between;">
              <span>จัดสรรแล้ว:</span>
              <span class="num-display" style="font-weight: var(--weight-semibold); color: ${allocCash.isZero() ? 'var(--muted-foreground)' : isCashMatch ? 'var(--income)' : 'var(--pending)'};">
                ${allocCash.format()}${allocCash.isZero() ? '' : !isCashMatch ? ` · ต่าง ${diffCash.format()}` : ''}
              </span>
            </div>
          </div>

          <!-- Transfer Expected -->
          <div style="background: var(--gl-stone-50); border: 1px solid var(--border); border-radius: var(--radius-md, 10px); padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--foreground); display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--info);"></span>เงินโอน
              </span>
              <span style="font-size: var(--text-2xs); font-weight: var(--weight-semibold); padding: 1px 6px; border-radius: 4px; background: var(--secondary); color: var(--on-info-muted);">เข้าธนาคาร
              </span>
            </div>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 10px; font-weight: var(--weight-bold); color: var(--muted-foreground); font-size: 14px;">฿</span>
              <input
                type="number"
                step="0.01"
                min="0"
                id="input-expected-transfer"
                name="expectedTransfer"
                value="${state.channels.transfer.toNumber() > 0 ? state.channels.transfer.toNumber() : ""}"
                placeholder="0.00"
                class="num-display"
                style="
                  width: 100%;
                  padding: 9px 12px 9px 30px;
                  border: 1px solid var(--border);
                  border-radius: var(--radius-sm, 8px);
                  background: var(--gl-white);
                  font-size: var(--text-base);
                  font-weight: var(--weight-bold);
                  color: var(--foreground);
                  text-align: right;
                "
              />
            </div>
            <div style="font-size: 11.5px; color: var(--muted-foreground); margin-top: 6px; display: flex; justify-content: space-between;">
              <span>จัดสรรแล้ว:</span>
              <span class="num-display" style="font-weight: var(--weight-semibold); color: ${allocTransfer.isZero() ? 'var(--muted-foreground)' : isTransferMatch ? 'var(--income)' : 'var(--pending)'};">
                ${allocTransfer.format()}${allocTransfer.isZero() ? '' : !isTransferMatch ? ` · ต่าง ${diffTransfer.format()}` : ''}
              </span>
            </div>
          </div>

          <!-- QR Expected -->
          <div style="background: var(--gl-stone-50); border: 1px solid var(--border); border-radius: var(--radius-md, 10px); padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--foreground); display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--pending);"></span>พร้อมเพย์ / QR Code
              </span>
              <span style="font-size: var(--text-2xs); font-weight: var(--weight-semibold); padding: 1px 6px; border-radius: 4px; background: var(--pending-muted); color: var(--on-pending-muted);">เข้าธนาคาร
              </span>
            </div>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 10px; font-weight: var(--weight-bold); color: var(--muted-foreground); font-size: 14px;">฿</span>
              <input
                type="number"
                step="0.01"
                min="0"
                id="input-expected-qr"
                name="expectedQr"
                value="${state.channels.qr.toNumber() > 0 ? state.channels.qr.toNumber() : ""}"
                placeholder="0.00"
                class="num-display"
                style="
                  width: 100%;
                  padding: 9px 12px 9px 30px;
                  border: 1px solid var(--border);
                  border-radius: var(--radius-sm, 8px);
                  background: var(--gl-white);
                  font-size: var(--text-base);
                  font-weight: var(--weight-bold);
                  color: var(--foreground);
                  text-align: right;
                "
              />
            </div>
            <div style="font-size: 11.5px; color: var(--muted-foreground); margin-top: 6px; display: flex; justify-content: space-between;">
              <span>จัดสรรแล้ว:</span>
              <span class="num-display" style="font-weight: var(--weight-semibold); color: ${allocQr.isZero() ? 'var(--muted-foreground)' : isQrMatch ? 'var(--income)' : 'var(--pending)'};">
                ${allocQr.format()}${allocQr.isZero() ? '' : !isQrMatch ? ` · ต่าง ${diffQr.format()}` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: Fund Allocations (Channel x Fund Breakdown) -->
      <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 22px 24px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground); margin: 0 0 2px 0; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span>2. จัดสรรเข้ากองทุน</span>
            </h3>
            <p style="font-size: 12.5px; color: var(--muted-foreground); margin: 0;">ระบุกองทุนเป้าหมายและช่องทางสำหรับแต่ละยอดเงิน
            </p>
          </div>

          <button
            type="button"
            id="btn-add-allocation-row"
            style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 7px 14px;
              border-radius: var(--radius-sm, 8px);
              border: 1px solid var(--border);
              background: var(--gl-white);
              color: var(--foreground);
              font-size: var(--text-sm);
              font-weight: var(--weight-semibold);
              cursor: pointer;
              transition: all 150ms ease;
            "
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>เพิ่มรายการกองทุน</span>
          </button>
        </div>

        <!-- Allocation Rows -->
        <div id="allocation-rows-container" style="display: flex; flex-direction: column; gap: 10px;">
          ${state.allocations.map((item) => {
            return `
            <div class="gl-allocation-row" data-row-id="${item.id}" style="
              display: grid;
              grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr auto;
              gap: 10px;
              align-items: center;
              padding: 10px 14px;
              background: var(--gl-stone-50);
              border: 1px solid var(--border);
              border-radius: var(--radius-sm, 8px);
            ">
              <!-- Fund Selector -->
              <div>
                <label style="display: block; font-size: var(--text-2xs); font-weight: var(--weight-semibold); color: var(--muted-foreground); margin-bottom: 3px;">กองทุน
                </label>
                <select
                  class="select-row-fund"
                  data-row-id="${item.id}"
                  style="
                    width: 100%;
                    padding: 7px 10px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: var(--card);
                    font-size: var(--text-sm);
                    color: var(--foreground);
                  "
                >
                  ${funds.map((f) => `
                    <option value="${f.id}" ${f.id === item.fundId ? "selected" : ""}>
                      ${escapeHtml(f.name)}
                    </option>
                  `).join("")}
                </select>
              </div>

              <!-- Channel Selector -->
              <div>
                <label style="display: block; font-size: var(--text-2xs); font-weight: var(--weight-semibold); color: var(--muted-foreground); margin-bottom: 3px;">ช่องทาง
                </label>
                <select
                  class="select-row-channel"
                  data-row-id="${item.id}"
                  style="
                    width: 100%;
                    padding: 7px 10px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: var(--card);
                    font-size: var(--text-sm);
                    color: var(--foreground);
                  "
                >
                  <option value="cash" ${item.channel === "cash" ? "selected" : ""}> เงินสด</option>
                  <option value="bank_transfer" ${item.channel === "bank_transfer" ? "selected" : ""}> เงินโอน</option>
                  <option value="qr_code" ${item.channel === "qr_code" ? "selected" : ""}> QR Code</option>
                </select>
              </div>

              <!-- Amount Input -->
              <div>
                <label style="display: block; font-size: var(--text-2xs); font-weight: var(--weight-semibold); color: var(--muted-foreground); margin-bottom: 3px;">จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  class="input-row-amount num-display"
                  data-row-id="${item.id}"
                  value="${item.amount.toNumber() > 0 ? item.amount.toNumber() : ""}"
                  placeholder="0.00"
                  style="
                    width: 100%;
                    padding: 7px 10px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: var(--card);
                    font-size: 13.5px;
                    font-weight: var(--weight-bold);
                    text-align: right;
                    color: var(--foreground);
                  "
                />
              </div>

              <!-- Notes / Donor Name -->
              <div>
                <label style="display: block; font-size: var(--text-2xs); font-weight: var(--weight-semibold); color: var(--muted-foreground); margin-bottom: 3px;">ผู้ถวาย / หมายเหตุ
                </label>
                <input
                  type="text"
                  class="input-row-donor"
                  data-row-id="${item.id}"
                  value="${item.donorName || ""}"
                  placeholder="ทั่วไป / ไม่ระบุชื่อ"
                  style="
                    width: 100%;
                    padding: 7px 10px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: var(--card);
                    font-size: 12.5px;
                    color: var(--foreground);
                  "
                />
              </div>

              <!-- Remove Row -->
              <div style="padding-top: 18px;">
                <button
                  type="button"
                  class="btn-remove-row"
                  data-row-id="${item.id}"
                  title="ลบแถวนี้"
                  style="
                    padding: 7px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: var(--card);
                    color: ${state.allocations.length > 1 ? 'var(--expense)' : 'var(--muted-foreground)'};
                    cursor: ${state.allocations.length > 1 ? 'pointer' : 'not-allowed'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                  ${state.allocations.length <= 1 ? "disabled" : ""}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
            `;
          }).join("")}
        </div>

        <!-- Allocation vs Expected Summary Bar -->
        ${
          totalAllocated.isZero() && grandExpected.isZero()
            ? `
        <div class="gl-notice" style="margin-top: var(--space-4);">
          <div class="gl-notice__body">กรอกยอดตามช่องทาง แล้วจัดสรรเข้ากองทุนให้ครบ</div>
        </div>`
            : `
        <div class="gl-notice ${isAllAllocMatched ? "gl-notice--success" : "gl-notice--warning"}" style="margin-top: var(--space-4); justify-content: space-between; flex-wrap: wrap;">
          <div class="gl-notice__body" style="font-weight: var(--weight-semibold);">
            ${isAllAllocMatched ? "ยอดจัดสรรถูกต้องตรงตามช่องทางทั้งหมด" : "ยอดจัดสรรกองทุนยังไม่ตรงกับยอดตามช่องทาง"}
          </div>
          <div class="num-display" style="font-size: var(--text-sm); font-weight: var(--weight-bold);">
            รวมจัดสรร: ${totalAllocated.format()} / คาดหวัง: ${grandExpected.format()}
          </div>
        </div>`
        }
      </div>

      <!-- Card 4: Session Notes (Optional) -->
      <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 20px 24px; margin-bottom: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <label for="input-session-notes" style="display: block; font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--foreground); margin-bottom: 6px;">หมายเหตุเพิ่มเติม
        </label>
        <textarea
          id="input-session-notes"
          name="notes"
          rows="2"
          placeholder="ระบุข้อสังเกต เช่น มีซองถวายโครงการสร้างอาคาร 3 ซอง หรือยอดโอนรอบบ่าย..."
          style="
            width: 100%;
            padding: 9px 12px;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm, 8px);
            background: var(--gl-white);
            font-size: var(--text-sm);
            color: var(--foreground);
            font-family: inherit;
            resize: vertical;
          "
        >${state.notes || ""}</textarea>
      </div>

      <!-- Action Footer -->
      <div class="gl-actionbar gl-actionbar--sticky" style="justify-content: flex-end;">
        <a href="#/offerings" style="
          padding: 10px 20px;
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--foreground);
          font-size: 14px;
          font-weight: var(--weight-semibold);
          text-decoration: none;
        ">ยกเลิก
        </a>

        <button
          type="button"
          id="btn-proceed-review"
          style="
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 24px;
            border-radius: var(--radius-md, 10px);
            border: none;
            background: var(--primary);
            color: var(--primary-foreground);
            font-size: 14px;
            font-weight: var(--weight-bold);
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(249, 115, 22, 0.3);
            transition: opacity 150ms ease;
          "
        >
          <span>ต่อไป · ตรวจทาน</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </form>
  </div>
  `;
}
