import { SupabaseClient } from "@supabase/supabase-js";
import { renderLoginStylesHtml } from "../components/login/loginStyles";
import {
  renderPinSetupHtml,
  PinSetupStep,
  isPinAcceptable,
} from "../components/login/PinSetupView";
import { PIN_LENGTH, renderDots, renderCountText } from "../components/login/PinEntryView";

export interface PinSetupUser {
  name: string;
  role?: string;
}

export class PinSetupPage {
  private step: PinSetupStep = "enter";
  private firstPin = "";
  private confirmPin = "";
  private errorMessage: string | null = null;
  private root: HTMLElement | null = null;
  private onCompleted: (() => void) | null = null;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly user: PinSetupUser
  ) {}

  public renderHtml(): string {
    const enteredLength = this.step === "enter" ? this.firstPin.length : this.confirmPin.length;

    return `
      ${renderLoginStylesHtml()}
      <div class="gl-login-screen">
        ${renderPinSetupHtml({
          step: this.step,
          enteredLength,
          userName: this.user.name,
          userRole: this.user.role,
          errorMessage: this.errorMessage,
        })}
      </div>
    `;
  }

  public attachEventListeners(root: HTMLElement, onCompleted: () => void): void {
    this.root = root;
    this.onCompleted = onCompleted;

    if (this.step === "saving" || this.step === "success") return;

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

    root.addEventListener("keydown", this.handleKeydown);
    root.querySelector<HTMLElement>("#setup-pin-group")?.focus();
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (this.step === "saving" || this.step === "success") return;

    const target = event.target as HTMLElement | null;
    const isOnControl = Boolean(target?.closest("button"));
    if (isOnControl && (event.key === "Enter" || event.key === " ")) return;

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
  };

  private pushDigit(digit: string): void {
    if (this.step === "saving" || this.step === "success") return;
    if (!/^[0-9]$/.test(digit)) return;

    if (this.step === "enter") {
      if (this.firstPin.length >= PIN_LENGTH) return;
      this.firstPin += digit;
      if (this.errorMessage) this.errorMessage = null;
      this.syncPinDom();

      if (this.firstPin.length === PIN_LENGTH) {
        this.handleFirstPinComplete();
      }
    } else if (this.step === "confirm") {
      if (this.confirmPin.length >= PIN_LENGTH) return;
      this.confirmPin += digit;
      if (this.errorMessage) this.errorMessage = null;
      this.syncPinDom();

      if (this.confirmPin.length === PIN_LENGTH) {
        this.handleConfirmPinComplete();
      }
    }
  }

  private popDigit(): void {
    if (this.step === "saving" || this.step === "success") return;

    if (this.step === "enter") {
      if (this.firstPin.length === 0) return;
      this.firstPin = this.firstPin.slice(0, -1);
      if (this.errorMessage) this.errorMessage = null;
      this.syncPinDom();
    } else if (this.step === "confirm") {
      if (this.confirmPin.length === 0) return;
      this.confirmPin = this.confirmPin.slice(0, -1);
      if (this.errorMessage) this.errorMessage = null;
      this.syncPinDom();
    }
  }

  private clearPin(): void {
    if (this.step === "saving" || this.step === "success") return;

    if (this.step === "enter") {
      this.firstPin = "";
    } else {
      this.confirmPin = "";
    }
    if (this.errorMessage) this.errorMessage = null;
    this.syncPinDom();
  }

  private handleFirstPinComplete(): void {
    if (!isPinAcceptable(this.firstPin)) {
      this.errorMessage = "รหัส PIN ง่ายเกินไป (ห้ามใช้เลขซ้ำหรือเลขเรียง)";
      this.firstPin = "";
      this.rerender();
      this.shakePinGroup();
      return;
    }

    // Advance to Step 2: Confirm PIN
    this.step = "confirm";
    this.confirmPin = "";
    this.errorMessage = null;
    this.rerender();
  }

  private handleConfirmPinComplete(): void {
    if (this.confirmPin !== this.firstPin) {
      this.errorMessage = "รหัส PIN ไม่ตรงกัน กรุณาลองใหม่อีกครั้ง";
      this.firstPin = "";
      this.confirmPin = "";
      this.step = "enter";
      this.rerender();
      this.shakePinGroup();
      return;
    }

    // PIN matched, submit to PostgreSQL RPC set_own_pin()
    void this.submitPin();
  }

  private async submitPin(): Promise<void> {
    this.step = "saving";
    this.rerender();

    const pinToSave = this.firstPin;
    // Wipe memory buffers
    this.firstPin = "";
    this.confirmPin = "";

    try {
      const { data, error } = await this.supabase.rpc("set_own_pin", {
        p_current_pin: null,
        p_new_pin: pinToSave,
      });

      const res = data as { status?: string } | null;

      if (error || res?.status !== "success") {
        console.error("set_own_pin failed:", error?.message || res?.status);
        this.step = "enter";
        this.errorMessage = res?.status === "weak_pin"
          ? "รหัส PIN ง่ายเกินไป กรุณาตั้งใหม่"
          : "บันทึกรหัส PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        this.rerender();
        this.shakePinGroup();
        return;
      }

      // Success
      this.step = "success";
      this.rerender();

      // Automatically sign out and redirect to login after confirmation
      window.setTimeout(async () => {
        await this.supabase.auth.signOut();
        this.onCompleted?.();
      }, 1600);
    } catch (err) {
      console.error("set_own_pin exception:", err);
      this.step = "enter";
      this.errorMessage = "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่";
      this.rerender();
    }
  }

  private syncPinDom(): void {
    if (!this.root) return;

    const len = this.step === "enter" ? this.firstPin.length : this.confirmPin.length;

    const group = this.root.querySelector<HTMLElement>("#setup-pin-group");
    if (group) group.innerHTML = renderDots(len);

    const count = this.root.querySelector<HTMLElement>("#setup-pin-count");
    if (count) count.textContent = renderCountText(len);

    const status = this.root.querySelector<HTMLElement>("#setup-pin-status");
    if (status) {
      status.textContent = this.errorMessage ?? "";
      if (this.errorMessage) {
        status.classList.add("gl-pin-status--error");
      } else {
        status.classList.remove("gl-pin-status--error");
      }
    }
  }

  private restoreGroupFocusAfterPointer(event: MouseEvent): void {
    if (event.detail === 0) return;
    this.root?.querySelector<HTMLElement>("#setup-pin-group")?.focus();
  }

  private shakePinGroup(): void {
    const group = this.root?.querySelector<HTMLElement>("#setup-pin-group");
    if (!group) return;
    group.setAttribute("data-shake", "true");
    window.setTimeout(() => group.removeAttribute("data-shake"), 350);
  }

  private rerender(): void {
    if (!this.root || !this.onCompleted) return;
    this.root.removeEventListener("keydown", this.handleKeydown);
    this.root.innerHTML = this.renderHtml();
    this.attachEventListeners(this.root, this.onCompleted);
  }
}
