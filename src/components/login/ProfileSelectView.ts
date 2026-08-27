import { LoginProfile } from "./types";
import { escapeHtml } from "./html";

export type ProfilesStatus = "loading" | "ready" | "empty" | "error";

export interface BootstrapModalState {
  isOpen: boolean;
  selectedProfileId: string | null;
  status: "idle" | "sending" | "sent" | "error";
  errorMessage?: string | null;
}

/** Minimal, typography-led profile selection. Fewer options = calmer entry. */
export function renderProfileSelectHtml(
  profiles: readonly LoginProfile[],
  selectedId: string | null,
  status: ProfilesStatus,
  bootstrapState: BootstrapModalState = { isOpen: false, selectedProfileId: null, status: "idle" }
): string {
  if (bootstrapState.isOpen) {
    return `
      <div class="gl-login-stage">
        ${renderBrandHtml()}
        ${renderBootstrapModalHtml(profiles, bootstrapState)}
      </div>
    `;
  }

  return `
    <div class="gl-login-stage">
      ${renderBrandHtml()}

      <p class="gl-login-eyebrow">เข้าสู่ระบบ</p>
      <h1 class="gl-login-heading">วันนี้ใครเข้าใช้งาน?</h1>

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
        <p class="gl-login-hint">กำลังโหลด...</p>
      </div>
    `;
  }

  if (status === "error") {
    return `
      <div class="gl-login-profiles-status" role="alert">
        <p class="gl-login-hint">โหลดรายชื่อไม่สำเร็จ</p>
        <button type="button" id="login-profiles-retry" class="gl-btn gl-btn--secondary gl-btn--sm">
          ลองใหม่
        </button>
      </div>
    `;
  }

  if (status === "empty") {
    return `
      <div class="gl-login-profiles-status" role="status">
        <p class="gl-login-hint">ยังไม่มีผู้ใช้งานในระบบ</p>
      </div>
    `;
  }

  // Show fewer options: if 1 profile, show it inline; if 2-4, compact row; if 5+, compact cards.
  const layout = profiles.length <= 1 ? "row-compact" : profiles.length <= 4 ? "row" : "grid";

  const items = profiles.map((profile) =>
    renderProfileItem(profile, profile.id === selectedId, layout)
  ).join("");

  return `
    <div class="gl-login-profiles gl-login-profiles--${layout}" id="login-profile-list">
      ${items}
    </div>

    ${profiles.length > 1 ? `
      <div class="gl-login-profiles-hint">
        <button type="button" id="login-trigger-bootstrap" class="gl-login-text-btn">
          ยังไม่มีบัญชี? ตั้งค่าครั้งแรก
        </button>
      </div>
    ` : ""}
  `;
}

function renderProfileItem(profile: LoginProfile, isSelected: boolean, layout: string): string {
  const name = escapeHtml(profile.name);
  const role = escapeHtml(profile.role);

  if (layout === "row-compact") {
    // Single profile — inline, no card.
    return `
      <button
        type="button"
        class="gl-profile-item gl-profile-item--row"
        data-profile-id="${escapeHtml(profile.id)}"
        data-selected="${isSelected ? "true" : "false"}"
        aria-label="เข้าใช้งานเป็น ${name} ${role}"
      >
        <span class="gl-profile-avatar gl-profile-avatar--sm" aria-hidden="true">${escapeHtml(profile.initials)}</span>
        <span class="gl-profile-text">
          <span class="gl-profile-name">${name}</span>
          <span class="gl-profile-role gl-profile-role--inline">${role}</span>
        </span>
      </button>
    `;
  }

  // Compact row (2-4 profiles) or grid (5+): keep card-like but minimize visual weight.
  return `
    <button
      type="button"
      class="gl-profile-item gl-profile-item--card"
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
  `;
}

function renderBootstrapModalHtml(
  profiles: readonly LoginProfile[],
  state: BootstrapModalState
): string {
  const isSending = state.status === "sending";
  const isSent = state.status === "sent";

  if (isSent) {
    return `
      <div class="gl-bootstrap-dialog" role="dialog" aria-labelledby="bootstrap-sent-title">
        <p class="gl-bootstrap-status-icon" aria-hidden="true">✓</p>
        <h2 id="bootstrap-sent-title" class="gl-bootstrap-title">ส่งลิงก์ตั้งค่า PIN แล้ว</h2>
        <p class="gl-bootstrap-desc">
          ระบบได้ส่ง One-Time Magic Link ไปยังอีเมลที่ลงทะเบียนไว้ของท่านเรียบร้อยแล้ว
          กรุณาเปิดลิงก์จากอีเมลเพื่อกำหนดรหัส PIN 6 หลัก
        </p>
        <button type="button" id="login-cancel-bootstrap" class="gl-btn gl-btn--primary gl-btn--block">
          กลับไปหน้าเลือกโปรไฟล์
        </button>
      </div>
    `;
  }

  const options = profiles.map((p) => {
    const selected = p.id === state.selectedProfileId ? "selected" : "";
    return `<option value="${escapeHtml(p.id)}" ${selected}>${escapeHtml(p.name)} (${escapeHtml(p.role)})</option>`;
  }).join("");

  return `
    <div class="gl-bootstrap-dialog" role="dialog" aria-labelledby="bootstrap-dialog-title">
      <h2 id="bootstrap-dialog-title" class="gl-bootstrap-title">ตั้งค่าการเข้าใช้งานครั้งแรก</h2>
      <p class="gl-bootstrap-desc">
        เลือกโปรไฟล์ของท่านเพื่อรับลิงก์ One-Time Magic Link ทางอีเมลสำหรับกำหนดรหัส PIN
      </p>

      ${state.errorMessage ? `<p class="gl-pin-status gl-pin-status--error" role="alert">${escapeHtml(state.errorMessage)}</p>` : ""}

      <div class="gl-bootstrap-field">
        <label for="bootstrap-profile-select" class="gl-bootstrap-label">เลือกโปรไฟล์ของท่าน</label>
        <select id="bootstrap-profile-select" class="gl-input" ${isSending ? "disabled" : ""}>
          ${options}
        </select>
      </div>

      <div class="gl-bootstrap-actions">
        <button type="button" id="login-cancel-bootstrap" class="gl-btn gl-btn--secondary" ${isSending ? "disabled" : ""}>
          ยกเลิก
        </button>
        <button type="button" id="login-send-bootstrap" class="gl-btn gl-btn--primary" ${isSending ? "disabled" : ""}>
          ${isSending ? '<span class="gl-pin-spinner" aria-hidden="true"></span> กำลังส่ง...' : "ส่งลิงก์ตั้งค่า PIN"}
        </button>
      </div>
    </div>
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
