export class LoginPage {
  private errorMessage: string | null = null;
  private isSubmitting = false;
  private isPasswordVisible = false;

  public setError(message: string | null): void {
    this.errorMessage = message;
  }

  public setSubmitting(value: boolean): void {
    this.isSubmitting = value;
  }

  public renderHtml(): string {
    const errorHtml = this.errorMessage
      ? `<div role="alert" aria-live="polite" class="gl-login-alert">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" class="gl-login-alert-icon">
            <circle cx="10" cy="10" r="8.25" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 6.5V10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="10" cy="13.25" r="0.9" fill="currentColor"/>
          </svg>
          <span>${escapeHtml(this.errorMessage)}</span>
        </div>`
      : "";

    return `
    <style>
      .gl-login-screen {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-6);
        font-family: var(--font-sans);
        position: relative;
        overflow: hidden;
        background: oklch(0.155 0.012 45);
      }
      .gl-login-glow {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(560px 420px at 50% -8%, oklch(0.32 0.09 45 / 55%), transparent 65%),
          radial-gradient(420px 320px at 88% 92%, oklch(0.24 0.05 45 / 45%), transparent 60%);
      }
      .gl-login-panel {
        position: relative;
        width: 100%;
        max-width: 388px;
        background: oklch(0.19 0.012 45);
        border: 1px solid oklch(1 0 0 / 10%);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-elevated), 0 30px 60px -20px rgb(0 0 0 / 0.45);
        padding: var(--space-8) var(--space-6);
        animation: gl-login-rise var(--duration-page) var(--ease-out);
      }
      @keyframes gl-login-rise {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .gl-login-mark {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-md);
        background: linear-gradient(155deg, var(--gl-orange-600), var(--gl-orange-700));
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-5);
        box-shadow: 0 8px 20px -8px oklch(0.65 0.19 45 / 60%);
      }
      .gl-login-title {
        font-weight: 800;
        font-size: 22px;
        letter-spacing: -0.01em;
        color: oklch(0.97 0.006 80);
        margin: 0 0 2px;
      }
      .gl-login-role {
        font-size: 13px;
        font-weight: 600;
        color: oklch(0.8 0.05 55);
        margin: 0 0 var(--space-1);
      }
      .gl-login-subtitle {
        font-size: 13px;
        line-height: 1.5;
        color: oklch(0.68 0.01 60);
        margin: 0 0 var(--space-6);
      }
      .gl-login-alert {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background: oklch(0.24 0.06 25);
        border: 1px solid oklch(0.4 0.1 25);
        color: oklch(0.88 0.06 25);
        font-size: 13px;
        line-height: 1.4;
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        margin-bottom: var(--space-5);
      }
      .gl-login-alert-icon { flex: none; width: 16px; height: 16px; margin-top: 1px; }
      .gl-login-field { margin-bottom: var(--space-4); }
      .gl-login-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: oklch(0.85 0.01 60);
        margin-bottom: 6px;
      }
      .gl-login-input-wrap { position: relative; }
      .gl-login-input {
        width: 100%;
        box-sizing: border-box;
        padding: 12px 14px;
        background: oklch(0.155 0.012 45);
        border: 1px solid oklch(1 0 0 / 12%);
        border-radius: var(--radius-input);
        color: oklch(0.96 0.006 80);
        font-size: 14px;
        font-family: inherit;
        min-height: var(--touch-target-min);
        transition: border-color var(--duration-micro) var(--ease-out), background var(--duration-micro) var(--ease-out);
      }
      .gl-login-input::placeholder { color: oklch(0.5 0.01 60); }
      .gl-login-input:hover { border-color: oklch(1 0 0 / 20%); }
      .gl-login-input:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 1px;
        border-color: transparent;
      }
      .gl-login-input[type="password"],
      .gl-login-input.gl-login-input--pw { padding-right: 44px; }
      .gl-login-toggle-pw {
        position: absolute;
        top: 0; bottom: 0; right: 4px;
        width: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: oklch(0.6 0.01 60);
        cursor: pointer;
        border-radius: var(--radius-sm);
      }
      .gl-login-toggle-pw:hover { color: oklch(0.85 0.01 60); }
      .gl-login-toggle-pw:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; }
      .gl-login-submit {
        width: 100%;
        min-height: var(--touch-target-min);
        padding: 12px;
        margin-top: var(--space-2);
        border: none;
        border-radius: var(--radius-button);
        background: var(--gl-orange-600);
        color: #ffffff;
        font-weight: 700;
        font-size: 15px;
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: background var(--duration-micro) var(--ease-out), transform var(--duration-micro) var(--ease-out);
      }
      .gl-login-submit:hover:not(:disabled) { background: var(--gl-orange-700); }
      .gl-login-submit:active:not(:disabled) { transform: scale(0.99); }
      .gl-login-submit:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
      .gl-login-submit:disabled { opacity: 0.7; cursor: not-allowed; }
      .gl-login-spinner {
        width: 16px; height: 16px;
        border-radius: 50%;
        border: 2px solid rgb(255 255 255 / 0.35);
        border-top-color: #ffffff;
        animation: gl-login-spin 0.7s linear infinite;
      }
      @keyframes gl-login-spin { to { transform: rotate(360deg); } }
      .gl-login-footer {
        margin-top: var(--space-6);
        font-size: 12px;
        color: oklch(0.5 0.01 60);
        text-align: center;
      }
      @media (max-width: 420px) {
        .gl-login-panel { max-width: 100%; padding: var(--space-6) var(--space-5); }
      }
    </style>
    <div class="gl-login-screen">
      <div class="gl-login-glow" aria-hidden="true"></div>
      <form id="login-form" class="gl-login-panel" novalidate>
        <div class="gl-login-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d="M6 5.5C6 4.67157 6.67157 4 7.5 4H16.5C17.3284 4 18 4.67157 18 5.5V19.5L12 16.5L6 19.5V5.5Z" fill="#ffffff"/>
          </svg>
        </div>

        <p class="gl-login-title">Grace Ledger</p>
        <p class="gl-login-role">ระบบการเงินคริสตจักร</p>
        <p class="gl-login-subtitle">จัดการการเงินอย่างโปร่งใส เป็นระบบ และตรวจสอบได้</p>

        ${errorHtml}

        <div class="gl-login-field">
          <label class="gl-login-label" for="login-email">อีเมล</label>
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
              class="gl-login-input"
              ${this.isSubmitting ? "disabled" : ""}
            />
          </div>
        </div>

        <div class="gl-login-field">
          <label class="gl-login-label" for="login-password">รหัสผ่าน</label>
          <div class="gl-login-input-wrap">
            <input
              id="login-password"
              name="password"
              type="${this.isPasswordVisible ? "text" : "password"}"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="gl-login-input gl-login-input--pw"
              ${this.isSubmitting ? "disabled" : ""}
            />
            <button
              type="button"
              id="login-toggle-password"
              class="gl-login-toggle-pw"
              aria-label="${this.isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}"
              aria-pressed="${this.isPasswordVisible ? "true" : "false"}"
              tabindex="-1"
            >
              ${this.isPasswordVisible ? eyeOffIcon() : eyeIcon()}
            </button>
          </div>
        </div>

        <button
          id="login-submit"
          type="submit"
          class="gl-login-submit"
          ${this.isSubmitting ? "disabled aria-busy=\"true\"" : ""}
        >
          ${this.isSubmitting ? `<span class="gl-login-spinner" aria-hidden="true"></span><span>กำลังเข้าสู่ระบบ...</span>` : "เข้าสู่ระบบ"}
        </button>

        <p class="gl-login-footer">ตรวจสอบได้ทุกรายการ · ปลอดภัยตามมาตรฐานคริสตจักร</p>
      </form>
    </div>
    `;
  }

  public attachEventListeners(root: HTMLElement, onSubmit: (email: string, password: string) => void): void {
    const form = root.querySelector<HTMLFormElement>("#login-form");
    if (!form) return;

    const passwordInput = root.querySelector<HTMLInputElement>("#login-password");
    const toggleBtn = root.querySelector<HTMLButtonElement>("#login-toggle-password");

    toggleBtn?.addEventListener("click", () => {
      this.isPasswordVisible = !this.isPasswordVisible;
      if (passwordInput) {
        passwordInput.type = this.isPasswordVisible ? "text" : "password";
        toggleBtn.setAttribute("aria-label", this.isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
        toggleBtn.setAttribute("aria-pressed", this.isPasswordVisible ? "true" : "false");
        toggleBtn.innerHTML = this.isPasswordVisible ? eyeOffIcon() : eyeIcon();
        passwordInput.focus();
      }
    });

    form.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isPasswordVisible && passwordInput) {
          this.isPasswordVisible = false;
          passwordInput.type = "password";
          toggleBtn?.setAttribute("aria-label", "แสดงรหัสผ่าน");
          toggleBtn?.setAttribute("aria-pressed", "false");
          if (toggleBtn) toggleBtn.innerHTML = eyeIcon();
        }
        (document.activeElement as HTMLElement | null)?.blur();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (this.isSubmitting) return;
      const email = (root.querySelector<HTMLInputElement>("#login-email")?.value ?? "").trim();
      const password = root.querySelector<HTMLInputElement>("#login-password")?.value ?? "";
      if (!email || !password) return;
      onSubmit(email, password);
    });
  }
}

function eyeIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
  </svg>`;
}

function eyeOffIcon(): string {
  return `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M2.5 2.5L17.5 17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8.28 4.68A9.7 9.7 0 0 1 10 4.5C15.5 4.5 18.5 10 18.5 10a13.6 13.6 0 0 1-3.02 3.6M5.6 5.98C3.13 7.47 1.5 10 1.5 10S4.5 15.5 10 15.5c1.02 0 1.96-.19 2.8-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8.2 11.8a2.5 2.5 0 0 0 3.6-3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
