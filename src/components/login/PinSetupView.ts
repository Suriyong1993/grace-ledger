import { renderDots, renderCountText } from "./PinEntryView";

export type PinSetupStep = "enter" | "confirm" | "saving" | "success";

export interface PinSetupState {
  step: PinSetupStep;
  enteredLength: number;
  userName: string;
  userRole?: string;
  errorMessage?: string | null;
  statusText?: string | null;
}

/**
 * Checks if a 6-digit PIN is acceptable according to standard security rules
 * (matches Postgres auth_pin_is_acceptable: no 6 repeated digits, no 6 sequential digits).
 */
export function isPinAcceptable(pin: string): boolean {
  if (!/^[0-9]{6}$/.test(pin)) return false;

  // Single repeated digit like 111111
  if (/^(.)\1{5}$/.test(pin)) return false;

  // Straight ascending or descending sequence
  let ascending = true;
  let descending = true;
  for (let i = 1; i < 6; i++) {
    if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) + 1) ascending = false;
    if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) - 1) descending = false;
  }

  return !(ascending || descending);
}

export function renderPinSetupHtml(state: PinSetupState): string {
  const isSaving = state.step === "saving";
  const isSuccess = state.step === "success";

  if (isSuccess) {
    return `
      <section class="gl-login-stage gl-login-stage--narrow" aria-labelledby="setup-pin-success-heading">
        <div class="gl-setup-success-card">
          <div class="gl-setup-success-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 id="setup-pin-success-heading" class="gl-setup-success-title">ตั้งรหัส PIN สำเร็จ!</h2>
          <p class="gl-setup-success-sub">บันทึกรหัส PIN เรียบร้อยแล้ว กำลังพาคุณไปยังหน้าเข้าสู่ระบบ...</p>
        </div>
      </section>
    `;
  }

  const promptTitle = state.step === "enter"
    ? "ตั้งรหัส PIN 6 หลักของคุณ"
    : "ยืนยันรหัส PIN 6 หลักอีกครั้ง";

  const promptSub = state.step === "enter"
    ? "ระบุรหัส PIN 6 หลักเพื่อใช้เข้าสู่ระบบในครั้งถัดไป"
    : "กดรหัส PIN เดิมอีกครั้งเพื่อยืนยันความถูกต้อง";

  const statusMessage = state.errorMessage || (isSaving ? "กำลังบันทึกรหัส PIN..." : "");
  const hasError = Boolean(state.errorMessage);

  return `
    <section class="gl-login-stage gl-login-stage--narrow" aria-labelledby="setup-pin-heading">
      <div class="gl-pin-identity">
        <div class="gl-pin-avatar" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 id="setup-pin-heading" class="gl-pin-name">${state.userName}</h2>
        ${state.userRole ? `<span class="gl-pin-role">${state.userRole}</span>` : ""}
      </div>

      <div class="gl-setup-prompt-wrap">
        <p class="gl-setup-step-badge">${state.step === "enter" ? "ขั้นตอนที่ 1 จาก 2" : "ขั้นตอนที่ 2 จาก 2"}</p>
        <p class="gl-pin-prompt">${promptTitle}</p>
        <p class="gl-setup-prompt-sub">${promptSub}</p>
      </div>

      <div
        id="setup-pin-group"
        class="gl-pin-group"
        role="group"
        aria-label="จุดแสดงรหัส PIN"
        tabindex="0"
      >
        ${renderDots(state.enteredLength)}
      </div>

      <p
        id="setup-pin-count"
        class="gl-sr-only"
        aria-live="polite"
      >${renderCountText(state.enteredLength)}</p>

      <div
        id="setup-pin-status"
        class="gl-pin-status ${hasError ? "gl-pin-status--error" : ""}"
        role="${hasError ? "alert" : "status"}"
        aria-live="polite"
      >
        ${isSaving ? '<span class="gl-pin-spinner" aria-hidden="true"></span>' : ""}
        <span>${statusMessage}</span>
      </div>

      <div class="gl-pin-keypad" role="group" aria-label="แป้นตัวเลขสำหรับตั้ง PIN">
        <button type="button" class="gl-pin-key" data-pin-key="1" aria-label="เลข 1" ${isSaving ? "disabled" : ""}>1</button>
        <button type="button" class="gl-pin-key" data-pin-key="2" aria-label="เลข 2" ${isSaving ? "disabled" : ""}>2</button>
        <button type="button" class="gl-pin-key" data-pin-key="3" aria-label="เลข 3" ${isSaving ? "disabled" : ""}>3</button>
        <button type="button" class="gl-pin-key" data-pin-key="4" aria-label="เลข 4" ${isSaving ? "disabled" : ""}>4</button>
        <button type="button" class="gl-pin-key" data-pin-key="5" aria-label="เลข 5" ${isSaving ? "disabled" : ""}>5</button>
        <button type="button" class="gl-pin-key" data-pin-key="6" aria-label="เลข 6" ${isSaving ? "disabled" : ""}>6</button>
        <button type="button" class="gl-pin-key" data-pin-key="7" aria-label="เลข 7" ${isSaving ? "disabled" : ""}>7</button>
        <button type="button" class="gl-pin-key" data-pin-key="8" aria-label="เลข 8" ${isSaving ? "disabled" : ""}>8</button>
        <button type="button" class="gl-pin-key" data-pin-key="9" aria-label="เลข 9" ${isSaving ? "disabled" : ""}>9</button>
        <button type="button" class="gl-pin-key gl-pin-key--action gl-pin-key--clear" data-pin-action="clear" aria-label="ล้างรหัส PIN ทั้งหมด" ${isSaving ? "disabled" : ""}>
          <span class="gl-pin-clear-text">ล้าง</span>
        </button>
        <button type="button" class="gl-pin-key gl-pin-key--zero" data-pin-key="0" aria-label="เลข 0" ${isSaving ? "disabled" : ""}>0</button>
        <button type="button" class="gl-pin-key gl-pin-key--action" data-pin-action="backspace" aria-label="ลบตัวเลขล่าสุด" ${isSaving ? "disabled" : ""}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
            <line x1="18" y1="9" x2="12" y2="15"></line>
            <line x1="12" y1="9" x2="18" y2="15"></line>
          </svg>
        </button>
      </div>

      <p class="gl-pin-note">
        ห้ามใช้รหัสที่คาดเดาได้ง่าย เช่น 111111 หรือ 123456
      </p>
    </section>
  `;
}
