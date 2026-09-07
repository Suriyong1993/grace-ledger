import { SupabaseClient } from "@supabase/supabase-js";
import { renderLoginStylesHtml } from "../components/login/loginStyles";
import {
  renderProfileSelectHtml,
  ProfilesStatus,
} from "../components/login/ProfileSelectView";
import {
  renderPinEntryHtml,
  renderDots,
  renderCountText,
  renderStatusText,
  PinStatus,
  PIN_LENGTH,
} from "../components/login/PinEntryView";
import { LoginProfile } from "../components/login/types";
import { escapeHtml } from "../components/login/html";
import { CHURCH_NAME_TH } from "../lib/org";
import {
  fetchLoginProfiles,
  requestPinBootstrap,
  verifyPin,
} from "../services/authPinService";
import { isDevProfile } from "../services/devRosterMarker";

type LoginView = "profiles" | "pin";
type PinAuthHandler = (userId: string) => void;

export interface LoginPageHandlers {
  onPinAuthenticated: PinAuthHandler;
}

const SELECTION_HANDOFF_MS = 140;

const VAULT_DIAL_SVG = `<svg viewBox="0 0 48 48" width="30" height="30" fill="none" aria-hidden="true">
  <circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="24" cy="24" r="11" stroke="currentColor" stroke-width="1.6"/>
  <path d="M24 5v8M24 35v8M5 24h8M35 24h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="currentColor"/>
</svg>`;

const VAULT_LOCK_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
  <rect x="5" y="10.5" width="14" height="9.5" rx="1.8" stroke="currentColor" stroke-width="1.8"/>
  <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

const VAULT_FACT_ICONS = {
  roles: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path d="M8 1.75l5 1.9v3.6c0 3.1-2 5.3-5 6.5-3-1.2-5-3.4-5-6.5v-3.6l5-1.9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M5.75 7.9l1.6 1.6 2.9-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  audit: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path d="M2.5 4h11M2.5 8h11M2.5 12h6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M11.25 11.25l1.4 1.4 2-2.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  pin: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <circle cx="5.25" cy="8" r="2.6" stroke="currentColor" stroke-width="1.3"/>
    <path d="M7.85 8h6.15M11.75 8v2.4M13.75 8v1.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,
};

export class LoginPage {
  private view: LoginView = "profiles";
  private selectedProfile: LoginProfile | null = null;
  private pin = "";
  private pinStatus: PinStatus = "idle";
  private pinLockedUntil: string | null = null;

  private profiles: LoginProfile[] = [];
  private profilesStatus: ProfilesStatus = "loading";
  private profilesLoadStarted = false;
  /** True while the visible roster is the dev harness, not the church's. */
  private isDevRoster = false;

  private root: HTMLElement | null = null;
  private handlers: LoginPageHandlers | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  public renderHtml(): string {
    const isNarrow = this.view === "pin";
    return `${renderLoginStylesHtml()}<div class="gl-login-screen gl-login-screen--vault">
      <div class="gl-login-vault-grid" aria-hidden="true"></div>
      <div class="gl-login-vault">
        <div class="gl-vault-brand">
          <span class="gl-vault-mark" aria-hidden="true">${VAULT_DIAL_SVG}</span>
          <span class="gl-vault-brandtext">
            <span class="gl-vault-wordmark" translate="no">Grace Ledger</span>
            <span class="gl-vault-church">${escapeHtml(CHURCH_NAME_TH)}</span>
          </span>
        </div>

        <div class="gl-vault-hero">
          <p class="gl-vault-eyebrow">ระบบการเงินคริสตจักร</p>
          <h2 class="gl-vault-title">ตู้เซฟการเงินของคริสตจักร</h2>
          <p class="gl-vault-sub">บันทึกโปร่งใส ตรวจสอบย้อนหลังได้ทุกรายการ</p>
        </div>

        <main class="gl-login-workspace">
          <div class="gl-login-card${isNarrow ? " gl-login-card--narrow" : ""}">
            ${this.renderDevRosterNoticeHtml()}
            ${this.renderViewHtml()}
            <div class="gl-login-trust-badge">
              <span aria-hidden="true">${VAULT_LOCK_SVG}</span>
              <span>รหัส PIN ได้รับการปกป้องในระดับหน่วยความจำ · แยกสิทธิ์การใช้งานตามบทบาท</span>
            </div>
          </div>
        </main>

        <ul class="gl-vault-facts">
          <li>${VAULT_FACT_ICONS.roles}แยกสิทธิ์ตามบทบาท</li>
          <li>${VAULT_FACT_ICONS.audit}ตรวจสอบย้อนหลังได้</li>
          <li>${VAULT_FACT_ICONS.pin}PIN 6 หลัก</li>
        </ul>
        ${renderDevPreviewLinkHtml()}
        <p class="gl-vault-foot">ระบบบัญชีและการเงินคริสตจักร</p>
      </div>
    </div>`;
  }

  /**
   * A demo roster must never be mistaken for the real one, so it says so on
   * the screen for as long as it is showing.
   */
  private renderDevRosterNoticeHtml(): string {
    if (!this.isDevRoster) return "";
    return `<p class="gl-login-devnotice" role="status">
      โหมดพัฒนา · เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังแสดงรายชื่อตัวอย่างเพื่อดูหน้าจอเท่านั้น (เข้าสู่ระบบจริงไม่ได้)
    </p>`;
  }

  private renderViewHtml(): string {
    if (this.view === "pin" && this.selectedProfile) {
      return renderPinEntryHtml(
        this.selectedProfile,
        this.pin.length,
        this.pinStatus,
        this.pinLockedUntil,
      );
    }
    return renderProfileSelectHtml(
      this.profiles,
      this.selectedProfile?.id ?? null,
      this.profilesStatus,
    );
  }

  public attachEventListeners(
    root: HTMLElement,
    handlers: LoginPageHandlers,
  ): void {
    this.root = root;
    this.handlers = handlers;
    if (this.view === "profiles") this.attachProfileListeners(root);
    if (this.view === "pin") this.attachPinListeners(root);
  }

  private attachProfileListeners(root: HTMLElement): void {
    if (!this.profilesLoadStarted) {
      this.profilesLoadStarted = true;
      void this.loadProfiles();
    }

    root
      .querySelector<HTMLButtonElement>("#login-profiles-retry")
      ?.addEventListener("click", () => {
        this.profilesLoadStarted = false;
        this.profilesStatus = "loading";
        this.rerender();
      });

    root
      .querySelectorAll<HTMLButtonElement>("[data-profile-id]")
      .forEach((card) => {
        card.addEventListener("click", () => {
          const profile =
            this.profiles.find(
              (candidate) => candidate.id === card.dataset.profileId,
            ) ?? null;
          if (!profile) return;

          this.selectedProfile = profile;
          root
            .querySelectorAll<HTMLButtonElement>("[data-profile-id]")
            .forEach((other) => {
              other.setAttribute("data-selected", String(other === card));
              other.setAttribute("aria-pressed", String(other === card));
            });

          window.setTimeout(
            () => this.goToPin(),
            prefersReducedMotion() ? 0 : SELECTION_HANDOFF_MS,
          );
        });
      });
  }

  private async loadProfiles(): Promise<void> {
    const result = await fetchLoginProfiles(this.supabase);
    if (result.status === "ready") {
      this.profiles = result.profiles;
      this.profilesStatus = "ready";
      this.isDevRoster = false;
      this.rerender();
      return;
    }

    // The roster endpoint is unreachable. On a dev build only — a preview
    // sandbox or a machine outside the function's CORS allowlist — fall back to
    // the demo roster so the screen can still be reviewed. Production keeps the
    // honest error state; see services/devRoster.ts.
    // import.meta.env.DEV is a compile-time constant, so this whole branch —
    // and the dynamic import of the demo names with it — is dropped from a
    // production build rather than merely being unreachable at runtime.
    if (result.status === "error" && import.meta.env.DEV) {
      console.warn(
        "login-profiles unreachable — showing the dev demo roster. " +
          "Sign-in still requires the real verify-pin endpoint.",
      );
      const { DEV_FALLBACK_PROFILES } = await import("../services/devRoster");
      this.profiles = [...DEV_FALLBACK_PROFILES];
      this.profilesStatus = "ready";
      this.isDevRoster = true;
      this.rerender();
      return;
    }

    this.profiles = [];
    this.profilesStatus = result.status;
    this.isDevRoster = false;
    this.rerender();
  }

  private attachPinListeners(root: HTMLElement): void {
    root
      .querySelector<HTMLButtonElement>("#login-pin-back")
      ?.addEventListener("click", () => this.goToProfiles());

    root
      .querySelectorAll<HTMLButtonElement>("[data-pin-key]")
      .forEach((key) => {
        key.addEventListener("click", (event) => {
          this.pushDigit(key.dataset.pinKey ?? "");
          this.restoreGroupFocusAfterPointer(event);
        });
      });

    root
      .querySelector<HTMLButtonElement>('[data-pin-action="backspace"]')
      ?.addEventListener("click", (event) => {
        this.popDigit();
        this.restoreGroupFocusAfterPointer(event);
      });

    root
      .querySelector<HTMLButtonElement>('[data-pin-action="clear"]')
      ?.addEventListener("click", (event) => {
        this.clearPin();
        this.restoreGroupFocusAfterPointer(event);
      });

    root
      .querySelector<HTMLButtonElement>("#login-pin-bootstrap")
      ?.addEventListener("click", (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        void this.requestPinBootstrap(button);
      });

    root.addEventListener("keydown", this.handlePinKeydown);
    root.querySelector<HTMLElement>("#login-pin-group")?.focus();
  }

  private handlePinKeydown = (event: KeyboardEvent): void => {
    if (this.view !== "pin") return;

    const target = event.target as HTMLElement | null;
    const isOnControl = Boolean(target?.closest("button"));
    if (isOnControl && (event.key === "Enter" || event.key === " ")) return;

    if (event.key === "Escape") {
      this.goToProfiles();
      return;
    }
    if (this.pinStatus === "checking") return;

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.pushDigit(event.key);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      this.popDigit();
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      this.clearPin();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.submitPin();
    }
  };

  private pushDigit(digit: string): void {
    if (this.pinStatus === "checking") return;
    if (!/^[0-9]$/.test(digit)) return;
    if (this.pin.length >= PIN_LENGTH) return;

    this.pin += digit;
    if (this.pinStatus !== "idle") this.pinStatus = "idle";
    this.syncPinDom();

    if (this.pin.length === PIN_LENGTH) this.submitPin();
  }

  private popDigit(): void {
    if (this.pinStatus === "checking") return;
    if (this.pin.length === 0) return;

    this.pin = this.pin.slice(0, -1);
    if (this.pinStatus !== "idle") this.pinStatus = "idle";
    this.syncPinDom();
  }

  private clearPin(): void {
    if (this.pinStatus === "checking") return;
    if (this.pin.length === 0) return;

    this.pin = "";
    if (this.pinStatus !== "idle") this.pinStatus = "idle";
    this.syncPinDom();
  }

  private async requestPinBootstrap(button: HTMLButtonElement): Promise<void> {
    const profile = this.selectedProfile;
    if (!profile || button.disabled) return;

    button.disabled = true;
    button.textContent = "กำลังส่งอีเมล…";

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const result = await requestPinBootstrap(
      this.supabase,
      profile.id,
      redirectTo,
    );

    if (result.status === "sent") {
      button.textContent = "ส่งลิงก์ไปที่อีเมลแล้ว";
      const status = this.root?.querySelector<HTMLElement>("#login-pin-status");
      if (status)
        status.textContent = "กรุณาเปิดลิงก์ในอีเมล แล้วทำตามขั้นตอนตั้ง PIN";
      return;
    }

    button.disabled = false;
    button.textContent =
      result.status === "rate_limited"
        ? "ส่งไปแล้ว กรุณาตรวจอีเมลหรือลองใหม่ภายหลัง"
        : "ส่งไม่สำเร็จ ลองอีกครั้ง";
  }

  private submitPin(): void {
    if (this.pinStatus === "checking") return;

    if (this.pin.length < PIN_LENGTH) {
      this.pinStatus = "incomplete";
      this.rerender();
      this.shakePinGroup();
      return;
    }

    this.pinStatus = "checking";
    this.rerender();
    void this.checkPin();
  }

  private async checkPin(): Promise<void> {
    const profile = this.selectedProfile;
    const pin = this.pin;
    if (!profile) return;

    // A demo row has no server-side identity: verify-pin would reject it after
    // a pointless round trip (or hang, since the backend is why the fallback
    // engaged). Say so immediately instead.
    if (isDevProfile(profile.id)) {
      this.pin = "";
      this.pinLockedUntil = null;
      this.pinStatus = "unavailable";
      this.rerender();
      this.shakePinGroup();
      return;
    }

    const outcome = await verifyPin(this.supabase, profile.id, pin);
    this.pin = "";

    if (outcome.status === "success") {
      this.pinStatus = "idle";
      this.handlers?.onPinAuthenticated(outcome.userId);
      return;
    }

    if (outcome.status === "requires_reset") {
      this.pinLockedUntil = null;
      this.pinStatus = "requires_reset";
      this.rerender();
      this.shakePinGroup();
      return;
    }

    this.pinLockedUntil =
      outcome.status === "locked" ? outcome.lockedUntil : null;
    this.pinStatus = outcome.status;
    this.rerender();
    this.shakePinGroup();
  }

  private syncPinDom(): void {
    if (!this.root) return;

    const group = this.root.querySelector<HTMLElement>("#login-pin-group");
    if (group) group.innerHTML = renderDots(this.pin.length);

    const count = this.root.querySelector<HTMLElement>("#login-pin-count");
    if (count) count.textContent = renderCountText(this.pin.length);

    const status = this.root.querySelector<HTMLElement>("#login-pin-status");
    if (status) {
      status.textContent = renderStatusText(
        this.pinStatus,
        this.pinLockedUntil,
      );
      if (this.pinStatus !== "idle" && this.pinStatus !== "checking") {
        status.classList.add("gl-pin-status--error");
      } else {
        status.classList.remove("gl-pin-status--error");
      }
    }
  }

  private restoreGroupFocusAfterPointer(event: MouseEvent): void {
    if (event.detail === 0) return;
    this.root?.querySelector<HTMLElement>("#login-pin-group")?.focus();
  }

  private shakePinGroup(): void {
    const group = this.root?.querySelector<HTMLElement>("#login-pin-group");
    if (!group) return;
    group.setAttribute("data-shake", "true");
    window.setTimeout(() => group.removeAttribute("data-shake"), 350);
  }

  private goToProfiles(): void {
    this.view = "profiles";
    this.selectedProfile = null;
    this.pin = "";
    this.pinStatus = "idle";
    this.pinLockedUntil = null;
    this.rerender();
  }

  private goToPin(): void {
    if (!this.selectedProfile) return;
    this.view = "pin";
    this.pin = "";
    this.pinStatus = "idle";
    this.pinLockedUntil = null;
    this.rerender();
  }

  private rerender(): void {
    if (!this.root || !this.handlers) return;
    this.root.removeEventListener("keydown", this.handlePinKeydown);
    this.root.innerHTML = this.renderHtml();
    this.attachEventListeners(this.root, this.handlers);
  }
}

/**
 * Dev-only way through to the screen harness.
 *
 * Sign-in needs a backend, so on a machine that cannot reach one the login
 * screen is a dead end and none of the app behind it can be looked at. This
 * link is the way through. `import.meta.env.DEV` is a compile-time constant,
 * so the whole thing is dropped from a production build.
 */
function renderDevPreviewLinkHtml(): string {
  if (!import.meta.env.DEV) return "";
  return `<a class="gl-login-devlink" href="/preview.html">
    เปิดหน้าตัวอย่าง (โหมดพัฒนา) →
  </a>`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}
