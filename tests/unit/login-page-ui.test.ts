import { describe, it, expect, vi } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { LoginPage } from "../../src/pages/LoginPage";
import { renderProfileSelectHtml } from "../../src/components/login/ProfileSelectView";
import {
  renderPinEntryHtml,
  renderDots,
  renderStatusText,
  PIN_LENGTH,
} from "../../src/components/login/PinEntryView";
import { LoginProfile } from "../../src/components/login/types";

const TEST_PROFILES: LoginProfile[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "อาจารย์สรรเสริญ ดวงจิตร", role: "ศิษยาภิบาล", initials: "สด" },
  { id: "22222222-2222-2222-2222-222222222222", name: "สุดารัตน์ จิณเซ่ง", role: "ผู้นับเงิน", initials: "สจ" },
];

/** LoginPage never calls a Supabase method in these tests (no DOM root is attached), so an unresolved stub is enough. */
function stubSupabase(): SupabaseClient {
  return { functions: { invoke: vi.fn() } } as unknown as SupabaseClient;
}

describe("LoginPage UI — strict PIN-only authentication", () => {
  describe("profile selection screen states", () => {
    it("shows a loading state before the roster is fetched with no email/password inputs", () => {
      const html = new LoginPage(stubSupabase()).renderHtml();
      expect(html).toContain("Grace Ledger");
      expect(html).toContain("วันนี้ใครเข้าใช้งาน?");
      expect(html).toContain("กำลังโหลด");
      expect(html).not.toContain('id="login-email"');
      expect(html).not.toContain('id="login-password"');
      expect(html).not.toContain('id="login-use-email"');
    });

    it("renders every profile as one labelled button once ready with no email fallback link", () => {
      const html = renderProfileSelectHtml(TEST_PROFILES, null, "ready");
      for (const profile of TEST_PROFILES) {
        expect(html).toContain(`data-profile-id="${profile.id}"`);
        expect(html).toContain(profile.name);
        expect(html).toContain(profile.role);
      }
      const cardCount = html.match(/data-profile-id="/g)?.length ?? 0;
      expect(cardCount).toBe(TEST_PROFILES.length);
      expect(html).not.toContain('id="login-use-email"');
      expect(html).not.toContain("เข้าสู่ระบบด้วยอีเมล");
    });

    it("marks the selected profile so the state is visible and accessible", () => {
      const selected = renderProfileSelectHtml(TEST_PROFILES, TEST_PROFILES[1].id, "ready");
      expect(selected).toMatch(
        new RegExp(`data-profile-id="${TEST_PROFILES[1].id}"\\s+data-selected="true"`)
      );
      expect(selected).toMatch(
        new RegExp(`data-profile-id="${TEST_PROFILES[0].id}"\\s+data-selected="false"`)
      );
    });

    it("offers a retry action when the roster fails to load", () => {
      const html = renderProfileSelectHtml([], null, "error");
      expect(html).toContain('id="login-profiles-retry"');
      expect(html).toContain('role="alert"');
      expect(html).not.toContain('id="login-use-email"');
    });

    it("states plainly when no one is registered yet", () => {
      const html = renderProfileSelectHtml([], null, "empty");
      expect(html).toContain("ยังไม่มีผู้ใช้งานในระบบ");
      expect(html).not.toContain('id="login-profile-list"');
    });
  });

  describe("PIN entry screen & number pad", () => {
    const profile = TEST_PROFILES[0];

    it("shows the chosen identity, the prompt, 0-9 digits, backspace, and clear button", () => {
      const html = renderPinEntryHtml(profile, 0, "idle");
      expect(html).toContain(profile.name);
      expect(html).toContain(profile.role);
      expect(html).toContain("ระบุรหัส PIN 6 หลัก");
      for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
        expect(html).toContain(`data-pin-key="${digit}"`);
      }
      expect(html).toContain('data-pin-action="backspace"');
      expect(html).toContain('data-pin-action="clear"');
      expect(html).toContain('id="login-pin-back"');
      expect(html).not.toContain('id="login-use-email"');
      expect(html).not.toContain("เข้าสู่ระบบด้วยอีเมล");
    });

    it("renders one dot per digit and fills only what was entered", () => {
      expect(renderDots(0).match(/gl-pin-dot/g)?.length).toBe(PIN_LENGTH);
      expect(renderDots(0).match(/is-filled/g) ?? []).toHaveLength(0);
      expect(renderDots(3).match(/is-filled/g)?.length).toBe(3);
      expect(renderDots(PIN_LENGTH).match(/is-filled/g)?.length).toBe(PIN_LENGTH);
    });

    it("shows the checking spinner while the PIN is being verified", () => {
      const html = renderPinEntryHtml(profile, PIN_LENGTH, "checking");
      expect(html).toContain("กำลังตรวจสอบรหัส PIN…");
      expect(html).toContain("gl-pin-spinner");
      expect(html).toMatch(/data-pin-key="1"\s+aria-label="เลข 1"\s+disabled/);
    });

    it("states incomplete, invalid, locked, requires_reset, and unavailable outcomes in plain Thai", () => {
      expect(renderStatusText("idle")).toBe("");
      expect(renderStatusText("checking")).toBe("กำลังตรวจสอบรหัส PIN…");
      expect(renderStatusText("incomplete")).toBe("กรุณาระบุ PIN ให้ครบ 6 หลัก");
      expect(renderStatusText("invalid")).toBe("รหัส PIN ไม่ถูกต้อง");
      expect(renderStatusText("locked", null)).toContain("ล็อก");
      expect(renderStatusText("requires_reset")).toBe("ต้องตั้งรหัส PIN ใหม่ก่อนเข้าใช้งาน");
      expect(renderStatusText("unavailable")).toContain("ไม่สามารถเชื่อมต่อระบบได้");
      expect(renderPinEntryHtml(profile, 2, "incomplete")).toContain("gl-pin-status--error");
    });

    it("disables the keypad and actions while locked", () => {
      const html = renderPinEntryHtml(profile, 0, "locked", null);
      expect(html).toMatch(/data-pin-key="1"\s+aria-label="เลข 1"\s+disabled/);
      expect(html).toMatch(/data-pin-action="clear"\s+aria-label="ล้างรหัส PIN ทั้งหมด"\s+disabled/);
    });

    it("announces progress for screen readers", () => {
      const html = renderPinEntryHtml(profile, 2, "idle");
      expect(html).toContain('id="login-pin-count"');
      expect(html).toContain("ระบุแล้ว 2 จาก 6 หลัก");
      expect(html).toContain('aria-live="polite"');
    });
  });
});
