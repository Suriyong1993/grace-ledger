import { LoginProfile } from "./types";
import { escapeHtml } from "./html";

export type ProfilesStatus = "loading" | "ready" | "empty" | "error";

/** Modern, mobile-first roster selection for PIN-only login. */
export function renderProfileSelectHtml(
  profiles: readonly LoginProfile[],
  selectedId: string | null,
  status: ProfilesStatus
): string {
  return `
    <div class="gl-login-stage">
      <div class="gl-login-hero">
        <p class="gl-login-eyebrow">เข้าสู่ระบบ</p>
        <h1 class="gl-login-heading">วันนี้ใครเข้าใช้งาน?</h1>
        <p class="gl-login-subheading">แตะโปรไฟล์ของท่านเพื่อเข้าใช้งานด้วย PIN 6 หลัก</p>
      </div>

      ${renderProfilesBodyHtml(profiles, selectedId, status)}
    </div>
  `;
}

function renderProfilesBodyHtml(
  profiles: readonly LoginProfile[],
  selectedId: string | null,
  status: ProfilesStatus
): string {
  if (status === "loading") {
    return `
      <div class="gl-login-profiles-status" role="status" aria-live="polite">
        <span class="gl-login-spinner gl-login-spinner--dark" aria-hidden="true"></span>
        <p class="gl-login-hint">กำลังโหลด…</p>
      </div>
    `;
  }

  if (status === "error") {
    return `
      <div class="gl-login-profiles-status" role="alert">
        <p class="gl-login-hint">โหลดรายชื่อไม่สำเร็จ</p>
        <button type="button" id="login-profiles-retry" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
      </div>
    `;
  }

  if (status === "empty") {
    return `
      <div class="gl-login-profiles-status" role="status">
        <p class="gl-login-hint">ยังไม่มีผู้ใช้งานในระบบ</p>
        <p class="gl-login-hint">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มผู้ใช้งานก่อนเข้าสู่ระบบ</p>
      </div>
    `;
  }

  const layout = profiles.length <= 1 ? "row-compact" : "grid";
  const items = profiles.map((profile) => renderProfileItem(profile, profile.id === selectedId, layout)).join("");

  return `
    <div class="gl-login-profiles gl-login-profiles--${layout}" id="login-profile-list" role="group" aria-label="รายการโปรไฟล์">
      ${items}
    </div>
  `;
}

function renderProfileItem(
  profile: LoginProfile,
  isSelected: boolean,
  layout: "grid" | "row-compact"
): string {
  const name = escapeHtml(profile.name);
  const role = escapeHtml(profile.role);

  return `
    <button
      type="button"
      class="gl-profile-item gl-profile-item--${layout === "grid" ? "card" : "row"}"
      data-profile-id="${escapeHtml(profile.id)}"
      data-selected="${isSelected ? "true" : "false"}"
      aria-pressed="${isSelected ? "true" : "false"}"
      aria-label="เข้าใช้งานเป็น ${name} ${role}"
    >
      <span class="gl-profile-avatar" aria-hidden="true">${escapeHtml(profile.initials)}</span>
      <span class="gl-profile-text">
        <span class="gl-profile-name">${name}</span>
        <span class="gl-profile-role">${role}</span>
      </span>
      <svg class="gl-profile-chevron" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
        <path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
}

export function renderBrandHtml(): string {
  return `
    <div class="gl-login-brand">
      <span class="gl-login-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <path d="M6 5.5C6 4.67157 6.67157 4 7.5 4H16.5C17.3284 4 18 4.67157 18 5.5V19.5L12 16.5L6 19.5V5.5Z" fill="currentColor"/>
        </svg>
      </span>
      <p class="gl-login-wordmark" translate="no">Grace Ledger</p>
      <p class="gl-login-tagline">ระบบการเงินคริสตจักร</p>
    </div>
  `;
}