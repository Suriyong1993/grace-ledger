import { describe, it, expect, vi } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  renderPinSetupHtml,
  isPinAcceptable,
} from "../../src/components/login/PinSetupView";
import { PinSetupPage } from "../../src/pages/PinSetupPage";

function stubSupabase(): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data: { status: "success" }, error: null }),
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  } as unknown as SupabaseClient;
}

describe("PIN Setup UI & Validation", () => {
  describe("isPinAcceptable heuristics", () => {
    it("rejects non-6-digit strings", () => {
      expect(isPinAcceptable("")).toBe(false);
      expect(isPinAcceptable("12345")).toBe(false);
      expect(isPinAcceptable("1234567")).toBe(false);
      expect(isPinAcceptable("abcdef")).toBe(false);
      expect(isPinAcceptable("12 456")).toBe(false);
    });

    it("rejects single repeated digit (e.g. 111111, 000000)", () => {
      expect(isPinAcceptable("111111")).toBe(false);
      expect(isPinAcceptable("000000")).toBe(false);
      expect(isPinAcceptable("777777")).toBe(false);
      expect(isPinAcceptable("999999")).toBe(false);
    });

    it("rejects straight ascending runs (e.g. 123456, 234567, 456789)", () => {
      expect(isPinAcceptable("123456")).toBe(false);
      expect(isPinAcceptable("234567")).toBe(false);
      expect(isPinAcceptable("456789")).toBe(false);
      expect(isPinAcceptable("012345")).toBe(false);
    });

    it("rejects straight descending runs (e.g. 654321, 987654)", () => {
      expect(isPinAcceptable("654321")).toBe(false);
      expect(isPinAcceptable("987654")).toBe(false);
      expect(isPinAcceptable("543210")).toBe(false);
    });

    it("accepts complex / unpredictable 6-digit PINs", () => {
      expect(isPinAcceptable("849201")).toBe(true);
      expect(isPinAcceptable("135790")).toBe(true);
      expect(isPinAcceptable("942816")).toBe(true);
      expect(isPinAcceptable("202608")).toBe(true);
      expect(isPinAcceptable("112233")).toBe(true);
    });
  });

  describe("renderPinSetupHtml states", () => {
    const mockUser = { name: "สุริยงค์ บาลเพ็ชร", role: "ผู้ดูแลระบบ" };

    it("renders Step 1 (Enter PIN) with user identity, step badge, and keypad", () => {
      const html = renderPinSetupHtml({
        step: "enter",
        enteredLength: 0,
        userName: mockUser.name,
        userRole: mockUser.role,
      });

      expect(html).toContain(mockUser.name);
      expect(html).toContain(mockUser.role);
      expect(html).toContain("ขั้นตอนที่ 1 จาก 2");
      expect(html).toContain("ตั้งรหัส PIN 6 หลักของคุณ");
      expect(html).toContain('data-pin-key="1"');
      expect(html).toContain('data-pin-action="clear"');
      expect(html).toContain('data-pin-action="backspace"');
    });

    it("renders Step 2 (Confirm PIN) with step badge and confirm prompt", () => {
      const html = renderPinSetupHtml({
        step: "confirm",
        enteredLength: 3,
        userName: mockUser.name,
        userRole: mockUser.role,
      });

      expect(html).toContain("ขั้นตอนที่ 2 จาก 2");
      expect(html).toContain("ยืนยันรหัส PIN 6 หลักอีกครั้ง");
      expect(html).toContain("กดรหัส PIN เดิมอีกครั้ง");
    });

    it("renders error status message when provided", () => {
      const html = renderPinSetupHtml({
        step: "enter",
        enteredLength: 0,
        userName: mockUser.name,
        errorMessage: "รหัส PIN ไม่ตรงกัน กรุณาลองใหม่อีกครั้ง",
      });

      expect(html).toContain("รหัส PIN ไม่ตรงกัน กรุณาลองใหม่อีกครั้ง");
      expect(html).toContain("gl-pin-status--error");
    });

    it("renders success card upon completion", () => {
      const html = renderPinSetupHtml({
        step: "success",
        enteredLength: 6,
        userName: mockUser.name,
      });

      expect(html).toContain("ตั้งรหัส PIN สำเร็จ!");
      expect(html).toContain("gl-setup-success-card");
      expect(html).not.toContain("gl-pin-keypad");
    });
  });

  describe("PinSetupPage class", () => {
    it("renders without error using stub client", () => {
      const page = new PinSetupPage(stubSupabase(), { name: "ทดสอบ ผู้ใช้" });
      const html = page.renderHtml();
      expect(html).toContain("ทดสอบ ผู้ใช้");
      expect(html).toContain("ตั้งรหัส PIN 6 หลักของคุณ");
    });
  });
});
