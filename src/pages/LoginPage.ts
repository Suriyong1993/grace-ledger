import { SupabaseClient } from "@supabase/supabase-js";
import { renderLoginStylesHtml } from "../components/login/loginStyles";
import { renderProfileSelectHtml, renderBrandHtml, ProfilesStatus } from "../components/login/ProfileSelectView";
import {
  renderPinEntryHtml,
  renderDots,
  renderCountText,
  renderStatusText,
  PinStatus,
  PIN_LENGTH,
} from "../components/login/PinEntryView";
import { LoginProfile } from "../components/login/types";
import { fetchLoginProfiles, requestPinBootstrap, verifyPin } from "../services/authPinService";

type LoginView = "profiles" | "pin";
type PinAuthHandler = (userId: string) => void;

export interface LoginPageHandlers {
  onPinAuthenticated: PinAuthHandler;
}

const SELECTION_HANDOFF_MS = 140;

export class LoginPage {
  private view: LoginView = "profiles";
  private selectedProfile: LoginProfile | null = null;
  private pin = "";
  private pinStatus: PinStatus = "idle";
  private pinLockedUntil: string | null = null;

  private profiles: LoginProfile[] = [];
  private profilesStatus: ProfilesStatus = "loading";
  private profilesLoadStarted = false;

  private root: HTMLElement | null = null;
  private handlers: LoginPageHandlers | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  public renderHtml(): string {
    return `${renderLoginStylesHtml()}<div class="gl-login-screen">
      <aside class="gl-login-panel" aria-hidden="false">
        ${renderBrandHtml()}
        <ol class="gl-login-steps" aria-label="ขั้นตอนการเข้าสู่ระบบ">
          <li><span class="gl-login-step-num" aria-hidden="true">1</span>เลือกโปรไฟล์ของท่าน</li>
          <li><span class="gl-login-step-num" aria-hidden="true">2</span>ระบุรหัส PIN 6 หลัก</li>
          <li><span class="gl-login-step-num" aria-hidden="true">3</span>เข้าใช้งานระบบการเงิน</li>
        </ol>
      </aside>
      <main class="gl-login-main">${this.renderViewHtml()}</main>
    </div>`;
  }

  private renderViewHtml(): string {
    if (this.view === "pin" && this.selectedProfile) {
      return renderPinEntryHtml(this.selectedProfile, this.pin.length, this.pinStatus, this.pinLockedUntil);
    }
    return renderProfileSelectHtml(this.profiles, this.selectedProfile?.id ?? null, this.profilesStatus);
  }

  public attachEventListeners(root: HTMLElement, handlers: LoginPageHandlers): void {
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

    root.querySelector<HTMLButtonElement>("#login-profiles-retry")?.addEventListener("click", () => {
      this.profilesLoadStarted = false;
      this.profilesStatus = "loading";
      this.rerender();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-profile-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const profile = this.profiles.find((candidate) => candidate.id === card.dataset.profileId) ?? null;
        if (!profile) return;

        this.selectedProfile = profile;
        root.querySelectorAll<HTMLButtonElement>("[data-profile-id]").forEach((other) => {
          other.setAttribute("data-selected", String(other === card));
          other.setAttribute("aria-pressed", String(other === card));
        });

        window.setTimeout(() => this.goToPin(), prefersReducedMotion() ? 0 : SELECTION_HANDOFF_MS);
      });
    });
  }

  private async loadProfiles(): Promise<void> {
    const result = await fetchLoginProfiles(this.supabase);
    if (result.status === "ready") {
      this.profiles = result.profiles;
      this.profilesStatus = "ready";
    } else {
      this.profiles = [];
      this.profilesStatus = result.status;
    }
    this.rerender();
  }

  private attachPinListeners(root: HTMLElement): void {
    root.querySelector<HTMLButtonElement>("#login-pin-back")?.addEventListener("click", () => this.goToProfiles());

    root.querySelectorAll<HTMLButtonElement>("[data-pin-key]").forEach((key) => {
      key.addEventListener("click", (event) => {
        this.pushDigit(key.dataset.pinKey ?? "");
        this.restoreGroupFocusAfterPointer(event);
      });
    });

    root.querySelector<HTMLButtonElement>('[data-pin-action="backspace"]')?.addEventListener("click", (event) => {
      this.popDigit();
      this.restoreGroupFocusAfterPointer(event);
    });

    root.querySelector<HTMLButtonElement>('[data-pin-action="clear"]')?.addEventListener("click", (event) => {
      this.clearPin();
      this.restoreGroupFocusAfterPointer(event);
    });

    root.querySelector<HTMLButtonElement>("#login-pin-bootstrap")?.addEventListener("click", (event) => {
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
    const result = await requestPinBootstrap(this.supabase, profile.id, redirectTo);

    if (result.status === "sent") {
      button.textContent = "ส่งลิงก์ไปที่อีเมลแล้ว";
      const status = this.root?.querySelector<HTMLElement>("#login-pin-status");
      if (status) status.textContent = "กรุณาเปิดลิงก์ในอีเมล แล้วทำตามขั้นตอนตั้ง PIN";
      return;
    }

    button.disabled = false;
    button.textContent = result.status === "rate_limited"
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

    this.pinLockedUntil = outcome.status === "locked" ? outcome.lockedUntil : null;
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
      status.textContent = renderStatusText(this.pinStatus, this.pinLockedUntil);
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

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}