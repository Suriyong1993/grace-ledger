import { LoginProfile } from "./mockProfiles";
import { escapeHtml } from "./html";

export type PinStatus = "idle" | "checking" | "incomplete" | "unavailable";

export const PIN_LENGTH = 6;

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Screen 2 — PIN entry. The keypad drives local UI state only: no credential
 * is sent anywhere and no session is created.
 */
export function renderPinEntryHtml(profile: LoginProfile, pinLength: number, status: PinStatus): string {
  const isChecking = status === "checking";

  return `
    <div class="gl-login-stage gl-login-stage--narrow">
      <button type="button" id="login-pin-back" class="gl-btn gl-btn--ghost gl-pin-back">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M12 4.5L6.5 10L12 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        กลับ
      </button>

      <div class="gl-pin-identity">
        <span class="gl-pin-avatar" aria-hidden="true">${escapeHtml(profile.initials)}</span>
        <h1 class="gl-pin-name">${escapeHtml(profile.name)}</h1>
        <p class="gl-pin-role">${escapeHtml(profile.role)}</p>
      </div>

      <p class="gl-pin-prompt" id="login-pin-prompt">ใส่รหัสของคุณ</p>

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
        class="gl-pin-status${status === "incomplete" || status === "unavailable" ? " gl-pin-status--error" : ""}"
        id="login-pin-status"
        role="status"
        aria-live="polite"
      >${isChecking ? '<span class="gl-pin-spinner" aria-hidden="true"></span>' : ""}${renderStatusText(status)}</p>

      <div class="gl-pin-keypad" id="login-pin-keypad">
        ${KEYPAD_DIGITS.map((digit) => renderKey(digit, isChecking)).join("")}
        ${renderKey("0", isChecking, "gl-pin-key--zero")}
        <button
          type="button"
          class="gl-pin-key gl-pin-key--action"
          data-pin-action="backspace"
          aria-label="ลบหนึ่งหลัก"
          ${isChecking ? "disabled" : ""}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M9 5.5H20V18.5H9L3.5 12L9 5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M12.5 9.5L16.5 14.5M16.5 9.5L12.5 14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <button type="button" id="login-use-email" class="gl-btn gl-btn--ghost gl-login-alt">
        เข้าสู่ระบบด้วยอีเมล
      </button>
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
  return `ใส่แล้ว ${pinLength} จาก ${PIN_LENGTH} หลัก`;
}

export function renderStatusText(status: PinStatus): string {
  if (status === "incomplete") return "ใส่ให้ครบ 6 หลัก";
  if (status === "unavailable") return "ยังใช้รหัสส่วนตัวเข้าสู่ระบบไม่ได้ ใช้อีเมลไปก่อน";
  if (status === "checking") return "กำลังเข้าสู่ระบบ...";
  return "";
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
