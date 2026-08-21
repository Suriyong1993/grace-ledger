export class LoginPage {
  private errorMessage: string | null = null;
  private isSubmitting = false;

  public setError(message: string | null): void {
    this.errorMessage = message;
  }

  public setSubmitting(value: boolean): void {
    this.isSubmitting = value;
  }

  public renderHtml(): string {
    const errorHtml = this.errorMessage
      ? `<div role="alert" style="
          background: var(--expense-muted);
          border: 1px solid var(--expense);
          color: var(--on-expense-muted);
          font-size: 13px;
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 14px;
        ">${escapeHtml(this.errorMessage)}</div>`
      : "";

    return `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--background);
      font-family: var(--font-sans, 'Sarabun', sans-serif);
      padding: 24px;
    ">
      <form id="login-form" style="
        width: 100%;
        max-width: 360px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 28px 24px;
      ">
        <div style="font-weight: 800; font-size: 18px; margin-bottom: 4px;">Grace Ledger</div>
        <div style="font-size: 13px; color: var(--muted-foreground); margin-bottom: 18px;">เข้าสู่ระบบเพื่อดำเนินการต่อ</div>

        ${errorHtml}

        <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px;">อีเมล</label>
        <input id="login-email" name="email" type="email" required autocomplete="username" style="
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 14px;
        " />

        <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px;">รหัสผ่าน</label>
        <input id="login-password" name="password" type="password" required autocomplete="current-password" style="
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 18px;
        " />

        <button id="login-submit" type="submit" ${this.isSubmitting ? "disabled" : ""} style="
          width: 100%;
          padding: 11px;
          border: none;
          border-radius: 8px;
          background: var(--primary);
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          opacity: ${this.isSubmitting ? "0.6" : "1"};
        ">${this.isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
      </form>
    </div>
    `;
  }

  public attachEventListeners(root: HTMLElement, onSubmit: (email: string, password: string) => void): void {
    const form = root.querySelector<HTMLFormElement>("#login-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = (root.querySelector<HTMLInputElement>("#login-email")?.value ?? "").trim();
      const password = root.querySelector<HTMLInputElement>("#login-password")?.value ?? "";
      if (!email || !password) return;
      onSubmit(email, password);
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
