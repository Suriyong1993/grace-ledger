import { SupabaseClient } from "@supabase/supabase-js";
import { renderLoginStylesHtml } from "../components/login/loginStyles";
import { renderProfileSelectHtml, ProfilesStatus } from "../components/login/ProfileSelectView";
import {
  renderPinEntryHtml,
  renderDots,
  renderCountText,
  renderStatusText,
  PinStatus,
  PIN_LENGTH,
} from "../components/login/PinEntryView";
import { renderEmailFallbackHtml, eyeIcon, eyeOffIcon } from "../components/login/EmailFallbackView";
import { LoginProfile } from "../components/login/types";
import { fetchLoginProfiles, verifyPin } from "../lib/auth/login-service";

type LoginView = "profiles" | "pin" | "email";

/** How long the selected profile stays visible before the PIN screen replaces it. */
const SELECTION_HANDOFF_MS = 160;

type LoginSubmitHandler = (email: string, password: string) => void;
type PinAuthHandler = (accessToken: string, refreshToken: string) => void;

export interface LoginPageHandlers {
  onEmailSubmit: LoginSubmitHandler;
  onPinAuthenticated: PinAuthHandler;
}

export class LoginPage {
  private view: LoginView = "profiles";
  private selectedProfile: LoginProfile | null = null;
  private pin = "";
  private pinStatus: PinStatus = "idle";
  private pinLockedUntil: string | null = null;

  private profiles: LoginProfile[] = [];
  private profilesStatus: ProfilesStatus = "loading";
  private profilesLoadStarted = false;

  private errorMessage: string | null = null;
  private isSubmitting = false;
  private isPasswordVisible = false;

  private root: HTMLElement | null = null;
  private handlers: LoginPageHandlers | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  public setError(message: string | null): void {
    this.errorMessage = message;
    if (message) this.view = "email";
  }

  public setSubmitting(value: boolean): void {
    this.isSubmitting = value;
  }

  public renderHtml(): string {
    return `${renderLoginStylesHtml()}<div class="gl-login-screen">${this.renderViewHtml()}</div>`;
  }

  private renderViewHtml(): string {
    if (this.view === "pin" && this.selectedProfile) {
      return renderPinEntryHtml(this.selectedProfile, this.pin.length, this.pinStatus, this.pinLockedUntil);
    }
    if (this.view === "email") {
      return renderEmailFallbackHtml({
        errorMessage: this.errorMessage,
        isSubmitting: this.isSubmitting,
        isPasswordVisible: this.isPasswordVisible,
      });
    }
    return renderProfileSelectHtml(this.profiles, this.selectedProfile?.id ?? null, this.profilesStatus);
  }

  public attachEventListeners(root: HTMLElement, handlers: LoginPageHandlers): void {
    this.root = root;
    this.handlers = handlers;

    root.querySelector<HTMLButtonElement>("#login-use-email")?.addEventListener("click", () => {
      this.goToEmail();
    });
    root.querySelector<HTMLButtonElement>("#login-back-to-profiles")?.addEventListener("click", () => {
      this.goToProfiles();
    });

    if (this.view === "profiles") this.attachProfileListeners(root);
    if (this.view === "pin") this.attachPinListeners(root);
    if (this.view === "email") this.attachEmailListeners(root, handlers.onEmailSubmit);
  }

  // ---------------------------------------------------------------- profiles

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
        root
          .querySelectorAll<HTMLButtonElement>("[data-profile-id]")
          .forEach((other) => other.setAttribute("data-selected", String(other === card)));

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

  // --------------------------------------------------------------------- pin

  private attachPinListeners(root: HTMLElement): void {
    root.querySelector<HTMLButtonElement>("#login-pin-back")?.addEventListener("click", () => {
      this.goToProfiles();
    });

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
      this.handlers?.onPinAuthenticated(outcome.accessToken, outcome.refreshToken);
      return;
    }

    this.pinLockedUntil = outcome.status === "locked" ? outcome.lockedUntil : null;
    this.pinStatus = outcome.status;
    this.rerender();
    this.shakePinGroup();
  }

  /** Digit changes update in place so keyboard focus and the keypad stay put. */
  private syncPinDom(): void {
    if (!this.root) return;

    const group = this.root.querySelector<HTMLElement>("#login-pin-group");
    if (group) group.innerHTML = renderDots(this.pin.length);

    const count = this.root.querySelector<HTMLElement>("#login-pin-count");
    if (count) count.textContent = renderCountText(this.pin.length);

    const status = this.root.querySelector<HTMLElement>("#login-pin-status");
    if (status) {
      status.textContent = renderStatusText(this.pinStatus, this.pinLockedUntil);
      status.classList.remove("gl-pin-status--error");
    }
  }

  /**
   * A tap leaves focus on the key that was pressed, so a following Enter would
   * re-fire that key instead of submitting. Hand focus back to the dots. Keyboard
   * activation (detail === 0) keeps its own focus so Tab order stays predictable.
   */
  private restoreGroupFocusAfterPointer(event: MouseEvent): void {
    if (event.detail === 0) return;
    this.root?.querySelector<HTMLElement>("#login-pin-group")?.focus();
  }

  private shakePinGroup(): void {
    const group = this.root?.querySelector<HTMLElement>("#login-pin-group");
    if (!group) return;
    group.setAttribute("data-shake", "true");
    window.setTimeout(() => group.removeAttribute("data-shake"), 300);
  }

  // ------------------------------------------------------------------- email

  private attachEmailListeners(root: HTMLElement, onSubmit: LoginSubmitHandler): void {
    const form = root.querySelector<HTMLFormElement>("#login-form");
    if (!form) return;

    const passwordInput = root.querySelector<HTMLInputElement>("#login-password");
    const toggleBtn = root.querySelector<HTMLButtonElement>("#login-toggle-password");

    toggleBtn?.addEventListener("click", () => {
      this.isPasswordVisible = !this.isPasswordVisible;
      if (!passwordInput) return;
      passwordInput.type = this.isPasswordVisible ? "text" : "password";
      toggleBtn.setAttribute("aria-label", this.isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
      toggleBtn.setAttribute("aria-pressed", this.isPasswordVisible ? "true" : "false");
      toggleBtn.innerHTML = this.isPasswordVisible ? eyeOffIcon() : eyeIcon();
      passwordInput.focus();
    });

    form.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.isPasswordVisible && passwordInput) {
        this.isPasswordVisible = false;
        passwordInput.type = "password";
        toggleBtn?.setAttribute("aria-label", "แสดงรหัสผ่าน");
        toggleBtn?.setAttribute("aria-pressed", "false");
        if (toggleBtn) toggleBtn.innerHTML = eyeIcon();
      }
      (document.activeElement as HTMLElement | null)?.blur();
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

  // ---------------------------------------------------------------- movement

  private goToProfiles(): void {
    this.view = "profiles";
    this.selectedProfile = null;
    this.pin = "";
    this.pinStatus = "idle";
    this.pinLockedUntil = null;
    this.errorMessage = null;
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

  private goToEmail(): void {
    this.view = "email";
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
