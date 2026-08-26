import { SupabaseClient } from "@supabase/supabase-js";
import { renderLoginStylesHtml } from "../components/login/loginStyles";
import {
  renderProfileSelectHtml,
  ProfilesStatus,
  BootstrapModalState,
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
import {
  fetchLoginProfiles,
  verifyPin,
  requestPinBootstrap,
} from "../lib/auth/login-service";

type LoginView = "profiles" | "pin";

/** How long the selected profile stays visible before the PIN screen replaces it. */
const SELECTION_HANDOFF_MS = 140;

type PinAuthHandler = (accessToken: string, refreshToken: string) => void;
type EmailSubmitHandler = (email: string, password: string) => void;

export interface LoginPageHandlers {
  onPinAuthenticated: PinAuthHandler;
  onEmailSubmit?: EmailSubmitHandler;
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

  private bootstrapState: BootstrapModalState = {
    isOpen: false,
    selectedProfileId: null,
    status: "idle",
  };

  private root: HTMLElement | null = null;
  private handlers: LoginPageHandlers | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  public setError(message: string | null): void {
    if (message) {
      this.pinStatus = "unavailable";
      this.rerender();
    }
  }

  public setSubmitting(value: boolean): void {
    this.pinStatus = value ? "checking" : "idle";
    this.rerender();
  }

  public renderHtml(): string {
    return `${renderLoginStylesHtml()}<div class="gl-login-screen">${this.renderViewHtml()}</div>`;
  }

  private renderViewHtml(): string {
    if (this.view === "pin" && this.selectedProfile) {
      return renderPinEntryHtml(this.selectedProfile, this.pin.length, this.pinStatus, this.pinLockedUntil);
    }
    return renderProfileSelectHtml(
      this.profiles,
      this.selectedProfile?.id ?? null,
      this.profilesStatus,
      this.bootstrapState
    );
  }

  public attachEventListeners(root: HTMLElement, handlers: LoginPageHandlers): void {
    this.root = root;
    this.handlers = handlers;

    root.querySelector<HTMLButtonElement>("#login-back-to-profiles")?.addEventListener("click", () => {
      this.goToProfiles();
    });

    if (this.view === "profiles") this.attachProfileListeners(root);
    if (this.view === "pin") this.attachPinListeners(root);
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

    // Profile card selection
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

    // Bootstrap trigger
    root.querySelector<HTMLButtonElement>("#login-trigger-bootstrap")?.addEventListener("click", () => {
      this.bootstrapState = {
        isOpen: true,
        selectedProfileId: this.profiles[0]?.id ?? null,
        status: "idle",
      };
      this.rerender();
    });

    root.querySelector<HTMLButtonElement>("#login-cancel-bootstrap")?.addEventListener("click", () => {
      this.bootstrapState = {
        isOpen: false,
        selectedProfileId: null,
        status: "idle",
      };
      this.rerender();
    });

    const selectEl = root.querySelector<HTMLSelectElement>("#bootstrap-profile-select");
    if (selectEl) {
      selectEl.addEventListener("change", () => {
        this.bootstrapState.selectedProfileId = selectEl.value;
      });
    }

    root.querySelector<HTMLButtonElement>("#login-send-bootstrap")?.addEventListener("click", async () => {
      const profileId = selectEl?.value || this.bootstrapState.selectedProfileId || this.profiles[0]?.id;
      if (!profileId) return;

      this.bootstrapState.status = "sending";
      this.bootstrapState.errorMessage = null;
      this.rerender();

      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await requestPinBootstrap(this.supabase, profileId, origin);

      if (res.status === "sent") {
        this.bootstrapState.status = "sent";
      } else if (res.status === "rate_limited") {
        this.bootstrapState.status = "error";
        this.bootstrapState.errorMessage = "คุณขอรหัสบ่อยเกินไป กรุณารอ 1 นาทีแล้วลองใหม่";
      } else {
        this.bootstrapState.status = "error";
        this.bootstrapState.errorMessage = "ไม่สามารถส่งคำขอได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
      }
      this.rerender();
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

    root.querySelector<HTMLButtonElement>('[data-pin-action="clear"]')?.addEventListener("click", (event) => {
      this.clearPin();
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
      if (this.pinStatus !== "idle" && this.pinStatus !== "checking") {
        status.classList.add("gl-pin-status--error");
      } else {
        status.classList.remove("gl-pin-status--error");
      }
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
    window.setTimeout(() => group.removeAttribute("data-shake"), 350);
  }

  // ---------------------------------------------------------------- movement

  private goToProfiles(): void {
    this.view = "profiles";
    this.selectedProfile = null;
    this.pin = "";
    this.pinStatus = "idle";
    this.pinLockedUntil = null;
    this.bootstrapState = {
      isOpen: false,
      selectedProfileId: null,
      status: "idle",
    };
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
