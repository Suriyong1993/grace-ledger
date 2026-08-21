/**
 * Presentation helpers shared by every screen.
 *
 * One date format for the whole app, and one place that turns an internal
 * error into something a treasurer can read.
 */

/** `2026-08-23` → `23 ส.ค. 2569`. Invalid input is returned untouched. */
export function formatDateThai(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

const ERROR_MESSAGES: ReadonlyArray<{ match: RegExp; message: string }> = [
  { match: /unsupported money input/i, message: "ข้อมูลจำนวนเงินไม่ครบ ลองโหลดหน้านี้ใหม่" },
  { match: /fetch|network|timeout|failed to/i, message: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" },
  { match: /permission|denied|rls|not authorized/i, message: "คุณไม่มีสิทธิ์ทำรายการนี้" },
  { match: /duplicate|already exists|conflict/i, message: "รายการนี้ถูกบันทึกไปแล้ว" },
];

/**
 * Maps an internal error to Thai UI copy. Thai messages raised deliberately by
 * the service layer pass through unchanged; anything else — including raw
 * exception text — is replaced.
 */
export function toUserMessage(error: unknown, fallback = "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง"): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  if (!raw) return fallback;

  // Already written for the user.
  if (/[฀-๿]/.test(raw)) return raw;

  for (const entry of ERROR_MESSAGES) {
    if (entry.match.test(raw)) return entry.message;
  }

  return fallback;
}
