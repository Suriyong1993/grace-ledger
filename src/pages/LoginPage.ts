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
      ? `<div role="alert" aria-live="polite" class="gl-notice gl-notice--error gl-login-alert">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" class="gl-login-alert-icon">
            <circle cx="10" cy="10" r="8.25" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 6.5V10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="10" cy="13.25" r="0.9" fill="currentColor"/>
          </svg>
          <span class="gl-notice__body">${escapeHtml(this.errorMessage)}</span>
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
        background: var(--background);
      }
      /* Panel takes .gl-card + .gl-card--elevated from the app stylesheet;
         only the width, padding and entrance are login-specific. */
      .gl-login-panel {
        width: 100%;
        max-width: 388px;
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
        background: linear-gradient(155deg, var(--primary), var(--primary-dark));
        color: var(--primary-foreground);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-5);
        box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--primary) 55%, transparent);
      }
      .gl-login-title {
        font-weight: var(--weight-bold);
        font-size: var(--text-2xl);
        letter-spacing: var(--tracking-heading);
        color: var(--foreground);
        margin: 0 0 2px;
      }
      .gl-login-role {
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        color: var(--accent-foreground);
        margin: 0 0 var(--space-1);
      }
      .gl-login-subtitle {
        font-size: var(--text-sm);
        line-height: var(--leading-body);
        color: var(--muted-foreground);
        margin: 0 0 var(--space-6);
      }
      /* Colour, border and radius come from .gl-notice--error. */
      .gl-login-alert {
        margin-bottom: var(--space-5);
      }
      .gl-login-alert-icon { flex: none; width: 16px; height: 16px; margin-top: 1px; }
      .gl-login-field { margin-bottom: var(--space-4); }
      .gl-login-label {
        display: block;
        margin-bottom: var(--space-1);
      }
      .gl-login-input-wrap { position: relative; }
      /* Field colour, border, radius and height come from .gl-input. */
      .gl-login-input[type="password"],
      .gl-login-input.gl-login-input--pw { padding-right: var(--touch-target-min); }
      .gl-login-toggle-pw {
        position: absolute;
        top: 0; bottom: 0; right: 4px;
        width: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: color var(--duration-micro) var(--ease-out);
      }
      .gl-login-toggle-pw:hover { color: var(--foreground); }
      .gl-login-toggle-pw:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; }
      /* Submit takes .gl-btn + .gl-btn--primary + .gl-btn--block. */
      .gl-login-submit { margin-top: var(--space-2); }
      .gl-login-spinner {
        width: 16px; height: 16px;
        border-radius: var(--radius-full);
        border: 2px solid color-mix(in srgb, var(--primary-foreground) 35%, transparent);
        border-top-color: var(--primary-foreground);
        animation: gl-login-spin 0.7s linear infinite;
      }
      @keyframes gl-login-spin { to { transform: rotate(360deg); } }
      .gl-login-footer {
        margin-top: var(--space-6);
        font-size: var(--text-xs);
        color: var(--muted-foreground);
        text-align: center;
      }
      @media (max-width: 420px) {
        .gl-login-panel { max-width: 100%; padding: var(--space-6) var(--space-5); }
      }
    </style>
    <div class="gl-login-screen">
      <form id="login-form" class="gl-card gl-card--elevated gl-login-panel" novalidate>
        <div class="gl-login-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d="M6 5.5C6 4.67157 6.67157 4 7.5 4H16.5C17.3284 4 18 4.67157 18 5.5V19.5L12 16.5L6 19.5V5.5Z" fill="currentColor"/>
          </svg>
        </div>

        <p class="gl-login-title">Grace Ledger</p>
        <p class="gl-login-role">ระบบการเงินคริสตจักร</p>
        <p class="gl-login-subtitle">จัดการการเงินอย่างโปร่งใส เป็นระบบ และตรวจสอบได้</p>

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
              class="gl-input gl-login-input"
              ${this.isSubmitting ? "disabled" : ""}
            />
          </div>
        </div>

        <div class="gl-login-field">
          <label class="gl-label gl-login-label" for="login-password">รหัสผ่าน</label>
          <div class="gl-login-input-wrap">
            <input
              id="login-password"
              name="password"
              type="${this.isPasswordVisible ? "text" : "password"}"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="gl-input gl-login-input gl-login-input--pw"
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
          class="gl-btn gl-btn--primary gl-btn--block gl-login-submit"
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
