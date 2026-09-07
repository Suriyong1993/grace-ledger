/**
 * Development-only roster fallback.
 *
 * The sign-in screen talks to the `login-profiles` Edge Function directly from
 * the browser, and that function only answers origins on its CORS allowlist
 * (production Vercel hosts plus localhost:5500/5173/4173). A preview sandbox —
 * or any machine that cannot reach the Supabase project at all — therefore gets
 * a load failure and the screen dead-ends on "โหลดรายชื่อไม่สำเร็จ", with no way
 * to look at or review the login UI itself.
 *
 * When the real call fails AND the bundle is a dev build, we substitute a small
 * fixed roster so the screen can be exercised. This is strictly a UI harness:
 *
 *   - `import.meta.env.DEV` is false in every production build, so Vite drops
 *     this branch from the shipped bundle entirely.
 *   - It is only reached AFTER the real endpoint has already failed, so a
 *     working backend is always preferred.
 *   - No PIN is verified here and no session is created. Sign-in still requires
 *     the real `verify-pin` function; the demo rows only render.
 */
import { LoginProfile } from "../components/login/types";
import { DEV_PROFILE_ID_PREFIX } from "./devRosterMarker";

export { DEV_PROFILE_ID_PREFIX, isDevProfile } from "./devRosterMarker";

/** True only in a dev server / dev build. Constant-folded away in production. */
export function isDevRosterFallbackEnabled(): boolean {
  return import.meta.env.DEV === true;
}

/**
 * Stand-in roster. The names mirror the fixtures used across the test suite and
 * the screenshot harness so the screen looks like the real thing at the same
 * name lengths (Thai honorifics are long and are what actually stress the
 * layout).
 */
export const DEV_FALLBACK_PROFILES: readonly LoginProfile[] = [
  {
    id: `${DEV_PROFILE_ID_PREFIX}1`,
    name: "อาจารย์สรรเสริญ ดวงจิตร",
    role: "ศิษยาภิบาล",
    initials: "สด",
  },
  {
    id: `${DEV_PROFILE_ID_PREFIX}2`,
    name: "อาจารย์ ทัศนา ดวงจิตร",
    role: "เหรัญญิก",
    initials: "ทด",
  },
  {
    id: `${DEV_PROFILE_ID_PREFIX}3`,
    name: "สุดารัตน์ จิณเซ่ง",
    role: "ผู้นับเงิน",
    initials: "สจ",
  },
  {
    id: `${DEV_PROFILE_ID_PREFIX}4`,
    name: "พณ.ท่านหม่อมราชวงศ์สุริยงค์ บาลเพ็ชร",
    role: "Super Admin / ผู้ตรวจสอบบัญชี",
    initials: "สบ",
  },
];
