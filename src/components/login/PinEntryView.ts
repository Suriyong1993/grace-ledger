import { LoginProfile } from "./types";
import { escapeHtml } from "./html";
import { formatDateThai } from "../../lib/format";

export type PinStatus = "idle" | "checking" | "incomplete" | "invalid" | "locked" | "unavailable" | "requires_reset";

export const PIN_LENGTH = 6;

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Screen 2 — PIN entry. The keypad drives local UI state only: no credential
 * is sent anywhere and no session is created.
 */
export function renderPinEntryHtml(
  profile: LoginProfile,
  pinLength: number,
  status: PinStatus,
  lockedUntil: string | null = null
): string {
  const isChecking = status === "checking";
  const isLocked = status === "locked";
  const isHardBlocked = isChecking || isLocked || status === "requires_reset";

  return `
    <div class="gl-login-stage gl-login-stage--narrow">
      <button type="button" id="login-pin-back" class="gl-btn gl-btn--ghost gl-pin-back">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M12 4.5L6.5 10L12 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        ย้อนกลับ
      </button>

      <div class="gl-pin-identity">
        <span class="gl-pin-avatar" aria-hidden="true">${escapeHtml(profile.initials)}</span>
        <span class="gl-pin-identity-pill">PIN 6 หลัก</span>
        <h1 class="gl-pin-name">${escapeHtml(profile.name)}</h1>
        <p class="gl-pin-role">${escapeHtml(profile.role)}</p>
      </div>

      <p class="gl-pin-prompt" id="login-pin-prompt">ระบุรหัส PIN 6 หลัก</p>
      <p class="gl-pin-hint">รองรับ number pad บนมือถือ และพิมพ์ตัวเลขจากคีย์บอร์ดได้</p>

      ${status === "requires_reset" ? `
        <div class="gl-pin-banner gl-pin-banner--warning" role="alert">
          ต้องตั้งรหัส PIN ใหม่ก่อนเข้าใช้งาน โปรดทำรายการรีเซ็ตให้เรียบร้อย
        </div>
      ` : ""}

      <div
        class="gl-pin-group"
        id="login-pin-group"
        role="group"
        tabindex="0"
        aria-labelledby="login-pin-prompt"
        aria-describedby="login-pin-status"
      >
        ${renderDots(pinLength)}
      </div>

      <p class="gl-visually-hidden" id="login-pin-count" role="status" aria-live="polite">
        ${renderCountText(pinLength)}
      </p>

      <p
        class="gl-pin-status${isStatusTextAlert(status) ? " gl-pin-status--error" : ""}"
        id="login-pin-status"
        role="status"
        aria-live="polite"
      >${isChecking ? '<span class="gl-pin-spinner" aria-hidden="true"></span>' : ""}${renderStatusText(status, lockedUntil)}</p>

      <div class="gl-pin-keypad" id="login-pin-keypad">
        ${KEYPAD_DIGITS.map((digit) => renderKey(digit, isHardBlocked)).join("")}
        <button
          type="button"
          class="gl-pin-key gl-pin-key--action gl-pin-key--clear"
          data-pin-action="clear"
          aria-label="ล้างรหัส PIN ทั้งหมด"
          ${isHardBlocked ? "disabled" : ""}
        >
          <span class="gl-pin-clear-text">ล้าง</span>
        </button>
        ${renderKey("0", isHardBlocked, "gl-pin-key--zero")}
        <button
          type="button"
          class="gl-pin-key gl-pin-key--action"
          data-pin-action="backspace"
          aria-label="ลบหนึ่งหลัก"
          ${isHardBlocked ? "disabled" : ""}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M9 5.5H20V18.5H9L3.5 12L9 5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M12.5 9.5L16.5 14.5M16.5 9.5L12.5 14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="gl-pin-bootstrap">
        <p class="gl-pin-bootstrap-text">ยังไม่มี PIN หรือเพิ่งเริ่มใช้งานครั้งแรก?</p>
        <button type="button" id="login-pin-bootstrap" class="gl-login-text-btn" ${isHardBlocked ? "disabled" : ""}>
          ขออีเมลสำหรับตั้ง PIN
        </button>
      </div>
    </div>
  `;
}

export function renderDots(pinLength: number): string {
  return Array.from({ length: PIN_LENGTH }, (_, index) => {
    const filled = index < pinLength;
    return `<span class="gl-pin-dot${filled ? " is-filled" : ""}" data-pin-dot="${index}" aria-hidden="true"></span>`;
  }).join("");
}

export function renderCountText(pinLength: number): string {
  return `ระบุแล้ว ${pinLength} จาก ${PIN_LENGTH} หลัก`;
}

export function renderStatusText(status: PinStatus, lockedUntil: string | null = null): string {
  if (status === "incomplete") return "กรุณาระบุ PIN ให้ครบ 6 หลัก";
  if (status === "invalid") return "รหัส PIN ไม่ถูกต้อง";
  if (status === "locked") {
    return lockedUntil
      ? `ระบบถูกล็อกชั่วคราว ลองใหม่หลัง ${formatDateThai(lockedUntil)}`
      : "ระบบถูกล็อกชั่วคราว ลองใหม่ภายหลัง";
  }
  if (status === "requires_reset") return "ต้องตั้งรหัส PIN ใหม่ก่อนเข้าใช้งาน";
  if (status === "unavailable") return "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง";
  if (status === "checking") return "กำลังตรวจสอบรหัส PIN…";
  return "";
}

function isStatusTextAlert(status: PinStatus): boolean {
  return (
    status === "incomplete" ||
    status === "invalid" ||
    status === "locked" ||
    status === "requires_reset" ||
    status === "unavailable"
  );
}

function renderKey(digit: string, isChecking: boolean, extraClass = ""): string {
  return `
    <button
      type="button"
      class="gl-pin-key${extraClass ? ` ${extraClass}` : ""}"
      data-pin-key="${digit}"
      aria-label="เลข ${digit}"
      ${isChecking ? "disabled" : ""}
    >${digit}</button>
  `;
}
