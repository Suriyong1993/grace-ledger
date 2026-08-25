import { LoginProfile } from "./types";
import { escapeHtml } from "./html";

export type ProfilesStatus = "loading" | "ready" | "empty" | "error";

/**
 * Screen 1 — who is signing in. Selection is local UI state only.
 */
export function renderProfileSelectHtml(
  profiles: readonly LoginProfile[],
  selectedId: string | null,
  status: ProfilesStatus
): string {
  return `
    <div class="gl-login-stage">
      ${renderBrandHtml()}

      <h1 class="gl-login-heading">วันนี้ใครเข้าใช้งาน?</h1>

      ${renderProfilesBodyHtml(profiles, selectedId, status)}

      <button type="button" id="login-use-email" class="gl-btn gl-btn--ghost gl-login-alt">
        เข้าสู่ระบบด้วยอีเมล
      </button>
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
        <p class="gl-login-hint">กำลังโหลดรายชื่อ...</p>
      </div>
    `;
  }

  if (status === "error") {
    return `
      <div class="gl-login-profiles-status" role="alert">
        <p class="gl-login-hint">โหลดรายชื่อไม่สำเร็จ</p>
        <button type="button" id="login-profiles-retry" class="gl-btn gl-btn--secondary">
          ลองใหม่
        </button>
      </div>
    `;
  }

  if (status === "empty") {
    return `
      <div class="gl-login-profiles-status" role="status">
        <p class="gl-login-hint">ยังไม่มีผู้ใช้งาน</p>
      </div>
    `;
  }

  const cards = profiles.map((profile) => renderProfileCard(profile, profile.id === selectedId)).join("");

  return `
    <ul class="gl-profile-grid" id="login-profile-grid">
      ${cards}
    </ul>

    <p class="gl-login-hint">เลือกโปรไฟล์ →</p>
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
      <p class="gl-login-wordmark">Grace Ledger</p>
      <p class="gl-login-tagline">ระบบการเงินคริสตจักร</p>
    </div>
  `;
}

function renderProfileCard(profile: LoginProfile, isSelected: boolean): string {
  const name = escapeHtml(profile.name);
  const role = escapeHtml(profile.role);

  return `
    <li>
      <button
        type="button"
        class="gl-card gl-profile-card"
        data-profile-id="${escapeHtml(profile.id)}"
        data-selected="${isSelected ? "true" : "false"}"
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
    </li>
  `;
}
