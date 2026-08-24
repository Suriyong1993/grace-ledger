/**
 * Presentation-only profiles for the profile-selection screen.
 *
 * These are mock records for the new login layout — not accounts. No database
 * row, no auth user, no role grant is implied by anything in this file, and
 * nothing here is sent to Supabase: picking a profile only moves local UI
 * state to the PIN screen. Replace with a church-scoped query once PIN
 * sign-in exists on the backend.
 */
export interface LoginProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  /** Pre-authored because Thai names carry honorifics that break naive splitting. */
  readonly initials: string;
}

export const MOCK_LOGIN_PROFILES: readonly LoginProfile[] = [
  {
    id: "mock-profile-1",
    name: "อาจารย์สรรเสริญ ดวงจิตร",
    role: "ศิษยาภิบาล",
    initials: "สด",
  },
  {
    id: "mock-profile-2",
    name: "อาจารย์ ทัศนา ดวงจิตร",
    role: "ผู้นับเงิน",
    initials: "ทด",
  },
  {
    id: "mock-profile-3",
    name: "สุดารัตน์ จิณเซ่ง",
    role: "ผู้นับเงิน",
    initials: "สจ",
  },
  {
    id: "mock-profile-4",
    name: "พณ.ท่านหม่อมราชวงศ์สุริยงค์ บาลเพ็ชร",
    role: "ผู้ตรวจสอบบัญชี · Super Admin",
    initials: "สบ",
  },
];

export function findMockProfile(id: string): LoginProfile | null {
  return MOCK_LOGIN_PROFILES.find((profile) => profile.id === id) ?? null;
}
