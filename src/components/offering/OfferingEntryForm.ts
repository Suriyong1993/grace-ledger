import { Money } from "../../lib/money";
import { escapeHtml } from "../../lib/format";
import {
  OfferingPaymentChannel,
  OfferingSourceType,
} from "../../lib/offering/types";

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
  /** The amount exactly as typed — Money round-trips eat partial input like "5.". */
  rawAmount?: string;
  donorName?: string;
  notes?: string;
}

export interface OfferingEntryFormState {
  serviceDate: string;
  serviceName: string;
  channels: ChannelAmountsState;
  /** Typed text for the channel amount inputs, bound back verbatim on re-render. */
  rawAmounts: { cash: string; transfer: string; qr: string };
  allocations: AllocationItemState[];
  notes?: string;
}

export interface OfferingEntryFormProps {
  funds: FundOption[];
  state: OfferingEntryFormState;
  validationErrors?: string[];
}

export function renderOfferingEntryFormHtml(
  props: OfferingEntryFormProps,
): string {
  const { funds, state, validationErrors = [] } = props;

  const grandExpected = state.channels.cash
    .add(state.channels.transfer)
    .add(state.channels.qr);

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
  const isAllAllocMatched =
    isCashMatch && isTransferMatch && isQrMatch && !grandExpected.isZero();

  return `
  <div class="gl-page gl-offering-entry-container gl-fade-in">
    <!-- Breadcrumb & Back -->
    <div style="margin-bottom: var(--space-5);">
      <a href="#/offerings" class="gl-offering-backlink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>กลับไปหน้ารายการ</span>
      </a>
    </div>

    <!-- Header & Step Indicator -->
    <div class="gl-page-header">
      <div class="gl-offering-step">
        <span class="gl-offering-step__badge" style="background: var(--primary); color: var(--primary-foreground);">1</span>
        <span class="gl-offering-step__label" style="color: var(--primary);">ขั้นตอนที่ 1 / 2: บันทึกข้อมูลและจัดสรรยอด</span>
      </div>
      <h1>บันทึกยอดเงินถวายวันอาทิตย์</h1>
    </div>

    <!-- Validation Errors Banner if any -->
    ${
      validationErrors.length > 0
        ? `
      <div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-6); flex-direction: column; align-items: stretch;">
        <div class="gl-notice__body" style="display: flex; align-items: center; gap: var(--space-2); font-weight: var(--weight-bold);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>กรุณาตรวจสอบข้อมูลก่อนดำเนินการ</span>
        </div>
        <ul style="margin: var(--space-2) 0 0; padding-left: var(--space-5);">
          ${validationErrors.map((err) => `<li>${err}</li>`).join("")}
        </ul>
      </div>
    `
        : ""
    }

    <!-- Form Body -->
    <form id="offering-entry-form" onsubmit="return false;">
      <!-- Service Details -->
      <div class="gl-card" style="margin-bottom: var(--space-5);">
        <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground); margin: 0 0 var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>ข้อมูลรอบนมัสการ</span>
        </h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4);">
          <div class="gl-field">
            <label for="input-service-date" class="gl-label">วันที่นมัสการ <span style="color: var(--destructive);">*</span></label>
            <input type="date" id="input-service-date" name="serviceDate" value="${state.serviceDate}" required class="gl-input" />
          </div>

          <div class="gl-field">
            <label for="input-service-name" class="gl-label">ชื่อรอบการนมัสการ <span style="color: var(--destructive);">*</span></label>
            <select id="input-service-name" name="serviceName" class="gl-select">
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
      <div class="gl-card" style="margin-bottom: var(--space-5);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
          <div>
            <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground); margin: 0 0 2px; display: flex; align-items: center; gap: var(--space-2);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
              <span>1. ยอดรวมตามช่องทาง</span>
            </h3>
            <p style="font-size: var(--text-xs); color: var(--muted-foreground); margin: 0;">ระบุยอดเงินรวมที่บันทึกได้จากซอง/สลิปของแต่ละช่องทาง</p>
          </div>

          <div style="text-align: right;">
            <span style="font-size: var(--text-xs); color: var(--muted-foreground);">ยอดรวมที่คาดหวังทั้งหมด: </span>
            <span class="num-display" data-entry="grand-expected" style="font-size: var(--text-md); font-weight: var(--weight-bold); color: var(--primary); margin-left: 4px;">${grandExpected.format()}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">
          <!-- Cash Expected -->
          <div class="gl-offering-chip" style="background: var(--secondary);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
              <span style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--foreground); display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--income);"></span>เงินสด
              </span>
              <span class="gl-badge gl-badge--approved">ส่งตรวจนับ</span>
            </div>
            <div style="position: relative;">
              <span style="position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); font-weight: var(--weight-bold); color: var(--muted-foreground);">฿</span>
              <input
                type="number" step="0.01" min="0" id="input-expected-cash" name="expectedCash"
                inputmode="decimal"
                value="${state.rawAmounts?.cash ?? (state.channels.cash.toNumber() > 0 ? state.channels.cash.toNumber() : "")}"
                placeholder="0.00" class="num-display gl-input"
                style="padding-left: 28px; font-weight: var(--weight-bold); text-align: right;"
              />
            </div>
            <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: var(--space-2); display: flex; justify-content: space-between;">
              <span>จัดสรรแล้ว:</span>
              <span class="num-display" data-entry="alloc-cash-status" style="font-weight: var(--weight-semibold); color: ${allocCash.isZero() ? "var(--muted-foreground)" : isCashMatch ? "var(--income)" : "var(--pending)"};">
                ${allocCash.format()}${allocCash.isZero() ? "" : !isCashMatch ? ` · ต่าง ${diffCash.format()}` : ""}
              </span>
            </div>
          </div>

          <!-- Transfer Expected -->
          <div class="gl-offering-chip" style="background: var(--secondary);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
              <span style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--foreground); display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--info);"></span>เงินโอน
              </span>
              <span class="gl-tag">เข้าธนาคาร</span>
            </div>
            <div style="position: relative;">
              <span style="position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); font-weight: var(--weight-bold); color: var(--muted-foreground);">฿</span>
              <input
                type="number" step="0.01" min="0" id="input-expected-transfer" name="expectedTransfer"
                inputmode="decimal"
                value="${state.rawAmounts?.transfer ?? (state.channels.transfer.toNumber() > 0 ? state.channels.transfer.toNumber() : "")}"
                placeholder="0.00" class="num-display gl-input"
                style="padding-left: 28px; font-weight: var(--weight-bold); text-align: right;"
              />
            </div>
            <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: var(--space-2); display: flex; justify-content: space-between;">
              <span>จัดสรรแล้ว:</span>
              <span class="num-display" data-entry="alloc-transfer-status" style="font-weight: var(--weight-semibold); color: ${allocTransfer.isZero() ? "var(--muted-foreground)" : isTransferMatch ? "var(--income)" : "var(--pending)"};">
                ${allocTransfer.format()}${allocTransfer.isZero() ? "" : !isTransferMatch ? ` · ต่าง ${diffTransfer.format()}` : ""}
              </span>
            </div>
          </div>

          <!-- QR Expected -->
          <div class="gl-offering-chip" style="background: var(--secondary);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
              <span style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--foreground); display: flex; align-items: center; gap: 6px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--pending);"></span>พร้อมเพย์ / QR Code
              </span>
              <span class="gl-badge gl-badge--pending">เข้าธนาคาร</span>
            </div>
            <div style="position: relative;">
              <span style="position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); font-weight: var(--weight-bold); color: var(--muted-foreground);">฿</span>
              <input
                type="number" step="0.01" min="0" id="input-expected-qr" name="expectedQr"
                inputmode="decimal"
                value="${state.rawAmounts?.qr ?? (state.channels.qr.toNumber() > 0 ? state.channels.qr.toNumber() : "")}"
                placeholder="0.00" class="num-display gl-input"
                style="padding-left: 28px; font-weight: var(--weight-bold); text-align: right;"
              />
            </div>
            <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: var(--space-2); display: flex; justify-content: space-between;">
              <span>จัดสรรแล้ว:</span>
              <span class="num-display" data-entry="alloc-qr-status" style="font-weight: var(--weight-semibold); color: ${allocQr.isZero() ? "var(--muted-foreground)" : isQrMatch ? "var(--income)" : "var(--pending)"};">
                ${allocQr.format()}${allocQr.isZero() ? "" : !isQrMatch ? ` · ต่าง ${diffQr.format()}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Fund Allocations (Channel x Fund Breakdown) -->
      <div class="gl-card" style="margin-bottom: var(--space-5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
          <div>
            <h3 style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--foreground); margin: 0 0 2px; display: flex; align-items: center; gap: var(--space-2);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span>2. จัดสรรเข้ากองทุน</span>
            </h3>
            <p style="font-size: var(--text-xs); color: var(--muted-foreground); margin: 0;">ระบุกองทุนเป้าหมายและช่องทางสำหรับแต่ละยอดเงิน</p>
          </div>

          <button type="button" id="btn-add-allocation-row" class="gl-btn gl-btn--secondary gl-btn--sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>เพิ่มรายการกองทุน</span>
          </button>
        </div>

        <!-- Allocation Rows -->
        <div id="allocation-rows-container" style="display: flex; flex-direction: column; gap: var(--space-3);">
          ${state.allocations
            .map((item) => {
              return `
            <div class="gl-allocation-row" data-row-id="${item.id}">
              <!-- Fund Selector -->
              <div class="gl-field" style="gap: 3px;">
                <label class="gl-label" style="font-size: var(--text-2xs); color: var(--muted-foreground);">กองทุน</label>
                <select class="select-row-fund gl-select" data-row-id="${item.id}">
                  ${funds
                    .map(
                      (f) => `
                    <option value="${f.id}" ${f.id === item.fundId ? "selected" : ""}>
                      ${escapeHtml(f.name)}
                    </option>
                  `,
                    )
                    .join("")}
                </select>
              </div>

              <!-- Channel Selector -->
              <div class="gl-field" style="gap: 3px;">
                <label class="gl-label" style="font-size: var(--text-2xs); color: var(--muted-foreground);">ช่องทาง</label>
                <select class="select-row-channel gl-select" data-row-id="${item.id}">
                  <option value="cash" ${item.channel === "cash" ? "selected" : ""}> เงินสด</option>
                  <option value="bank_transfer" ${item.channel === "bank_transfer" ? "selected" : ""}> เงินโอน</option>
                  <option value="qr_code" ${item.channel === "qr_code" ? "selected" : ""}> QR Code</option>
                </select>
              </div>

              <!-- Amount Input -->
              <div class="gl-field" style="gap: 3px;">
                <label class="gl-label" style="font-size: var(--text-2xs); color: var(--muted-foreground);">จำนวนเงิน (บาท)</label>
                <input
                  type="number" step="0.01" min="0" class="input-row-amount num-display gl-input"
                  data-row-id="${item.id}"
                  inputmode="decimal"
                  value="${item.rawAmount ?? (item.amount.toNumber() > 0 ? item.amount.toNumber() : "")}"
                  placeholder="0.00" style="font-weight: var(--weight-bold); text-align: right;"
                />
              </div>

              <!-- Notes / Donor Name -->
              <div class="gl-field" style="gap: 3px;">
                <label class="gl-label" style="font-size: var(--text-2xs); color: var(--muted-foreground);">ผู้ถวาย / หมายเหตุ</label>
                <input
                  type="text" class="input-row-donor gl-input" data-row-id="${item.id}"
                  value="${item.donorName || ""}" placeholder="ทั่วไป / ไม่ระบุชื่อ"
                />
              </div>

              <!-- Remove Row -->
              <button
                type="button" class="btn-remove-row gl-icon-btn" data-row-id="${item.id}" title="ลบแถวนี้"
                style="color: ${state.allocations.length > 1 ? "var(--expense)" : "var(--muted-foreground)"};"
                ${state.allocations.length <= 1 ? "disabled" : ""}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
            `;
            })
            .join("")}
        </div>

        <!-- Allocation vs Expected Summary Bar -->
        ${
          totalAllocated.isZero() && grandExpected.isZero()
            ? `
        <div class="gl-notice" data-entry="summary-notice" style="margin-top: var(--space-4);">
          <div class="gl-notice__body" data-entry="summary-notice-body">กรอกยอดตามช่องทาง แล้วจัดสรรเข้ากองทุนให้ครบ</div>
          <div class="num-display" data-entry="summary-notice-amount" style="font-size: var(--text-sm); font-weight: var(--weight-bold); display: none;"></div>
        </div>`
            : `
        <div class="gl-notice ${isAllAllocMatched ? "gl-notice--success" : "gl-notice--warning"}" data-entry="summary-notice" style="margin-top: var(--space-4); justify-content: space-between; flex-wrap: wrap;">
          <div class="gl-notice__body" data-entry="summary-notice-body" style="font-weight: var(--weight-semibold);">
            ${isAllAllocMatched ? "ยอดจัดสรรถูกต้องตรงตามช่องทางทั้งหมด" : "ยอดจัดสรรกองทุนยังไม่ตรงกับยอดตามช่องทาง"}
          </div>
          <div class="num-display" data-entry="summary-notice-amount" style="font-size: var(--text-sm); font-weight: var(--weight-bold);">
            รวมจัดสรร: ${totalAllocated.format()} / คาดหวัง: ${grandExpected.format()}
          </div>
        </div>`
        }
      </div>

      <!-- Session Notes (Optional) -->
      <div class="gl-card" style="margin-bottom: var(--space-6);">
        <label for="input-session-notes" class="gl-label">หมายเหตุเพิ่มเติม</label>
        <textarea
          id="input-session-notes" name="notes" rows="2"
          placeholder="ระบุข้อสังเกต เช่น มีซองถวายโครงการสร้างอาคาร 3 ซอง หรือยอดโอนรอบบ่าย..."
          class="gl-textarea" style="margin-top: var(--space-2);"
        >${state.notes || ""}</textarea>
      </div>

      <!-- Action Footer -->
      <div class="gl-actionbar gl-actionbar--sticky" style="justify-content: flex-end;">
        <a href="#/offerings" class="gl-btn gl-btn--secondary">ยกเลิก</a>

        <button type="button" id="btn-proceed-review" class="gl-btn gl-btn--primary">
          <span>ต่อไป · ตรวจทาน</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </form>
  </div>
  `;
}
