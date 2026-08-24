import { escapeHtml } from "./html";
import { renderBrandHtml } from "./ProfileSelectView";

export interface EmailFallbackState {
  errorMessage: string | null;
  isSubmitting: boolean;
  isPasswordVisible: boolean;
}

/**
 * Recovery path. Email + password is still the authentication that actually
 * runs, so the form stays complete and functional — only quiet.
 */
export function renderEmailFallbackHtml(state: EmailFallbackState): string {
  const { errorMessage, isSubmitting, isPasswordVisible } = state;

  const errorHtml = errorMessage
    ? `<div role="alert" aria-live="polite" class="gl-notice gl-notice--error gl-login-alert">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" class="gl-login-alert-icon">
          <circle cx="10" cy="10" r="8.25" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 6.5V10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="10" cy="13.25" r="0.9" fill="currentColor"/>
        </svg>
        <span class="gl-notice__body">${escapeHtml(errorMessage)}</span>
      </div>`
    : "";

  return `
    <div class="gl-login-stage gl-login-stage--narrow">
      <button type="button" id="login-back-to-profiles" class="gl-btn gl-btn--ghost gl-pin-back">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M12 4.5L6.5 10L12 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        กลับ
      </button>

      ${renderBrandHtml()}

      <form id="login-form" class="gl-card gl-login-panel" novalidate>
        <h1 class="gl-login-panel-title">เข้าสู่ระบบด้วยอีเมล</h1>
        <p class="gl-login-panel-sub">ใช้บัญชีเดิมของคุณ</p>

        ${errorHtml}

        <div class="gl-login-field">
          <label class="gl-label gl-login-label" for="login-email">อีเมล</label>
          <div class="gl-login-input-wrap">
            <input
              id="login-email"
              name="email"
              type="email"
              inputmode="email"
              required
              autocomplete="username"
              autofocus
              placeholder="you@church.org"
              class="gl-input"
              ${isSubmitting ? "disabled" : ""}
            />
          </div>
        </div>

        <div class="gl-login-field">
          <label class="gl-label gl-login-label" for="login-password">รหัสผ่าน</label>
          <div class="gl-login-input-wrap">
            <input
              id="login-password"
              name="password"
              type="${isPasswordVisible ? "text" : "password"}"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="gl-input gl-login-input--pw"
              ${isSubmitting ? "disabled" : ""}
            />
            <button
              type="button"
              id="login-toggle-password"
              class="gl-login-toggle-pw"
              aria-label="${isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}"
              aria-pressed="${isPasswordVisible ? "true" : "false"}"
              tabindex="-1"
            >
              ${isPasswordVisible ? eyeOffIcon() : eyeIcon()}
            </button>
          </div>
        </div>

        <button
          id="login-submit"
          type="submit"
          class="gl-btn gl-btn--primary gl-btn--block gl-login-submit"
          ${isSubmitting ? 'disabled aria-busy="true"' : ""}
        >
          ${
            isSubmitting
              ? `<span class="gl-login-spinner" aria-hidden="true"></span><span>กำลังเข้าสู่ระบบ...</span>`
              : "เข้าสู่ระบบ"
          }
        </button>
      </form>
    </div>
  `;
}

export function eyeIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
  </svg>`;
}

export function eyeOffIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M2.5 2.5L17.5 17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8.28 4.68A9.7 9.7 0 0 1 10 4.5C15.5 4.5 18.5 10 18.5 10a13.6 13.6 0 0 1-3.02 3.6M5.6 5.98C3.13 7.47 1.5 10 1.5 10S4.5 15.5 10 15.5c1.02 0 1.96-.19 2.8-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8.2 11.8a2.5 2.5 0 0 0 3.6-3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}
