import { SupabaseClient } from "@supabase/supabase-js";
import { AppShellUser } from "../components/layout/AppShell";
import { escapeHtml } from "../lib/format";

export interface ProfilePageProps {
  user: AppShellUser;
  userId: string;
  churchId: string;
}

export class ProfilePage {
  private props: ProfilePageProps;

  constructor(_supabase: SupabaseClient, props: ProfilePageProps) {
    this.props = props;
  }

  public updateProps(props: ProfilePageProps): void {
    this.props = props;
  }

  public renderHtml(): string {
    const { user, userId } = this.props;
    const displayName = escapeHtml(user.name || "ไม่ระบุชื่อ");
    const displayRole = escapeHtml(user.role || "สมาชิก");
    const initials = escapeHtml(user.initials || "?");
    const churchName = escapeHtml(user.churchName || "คริสตจักร");

    return `
      <div class="gl-page gl-profile gl-fade-in">
        <!-- Profile Identity Card -->
        <div class="gl-card gl-profile__card">
          <div class="gl-profile__head">
            <div class="gl-profile__avatar" aria-hidden="true">${initials}</div>
            <div class="gl-profile__body">
              <h1 class="gl-profile__name">${displayName}</h1>
              <div class="gl-profile__idrow">
                <span class="gl-profile__role">${displayRole}</span>
                <span class="gl-profile__meta">${churchName}</span>
              </div>
            </div>
          </div>

          <div class="gl-profile__uuid">
            <span>รหัสผู้ใช้งาน</span>
            <span class="num-display gl-profile__uuid-value">${userId.slice(0, 8)}...${userId.slice(-6)}</span>
          </div>
        </div>

        <!-- Quick Access Hub (Mobile Navigation to secondary modules) -->
        <div class="gl-card gl-profile__card gl-profile__card--tight">
          <div class="kicker" style="margin-bottom: var(--space-3);">ระบบงานเพิ่มเติม</div>
          <div class="gl-profile__links">
            <a href="#/transactions" class="gl-profile__link">
              <span class="gl-profile__link-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2"/><path d="M3 10h18"/></svg>
              </span>
              <span>รายการธุรกรรมการเงิน</span>
              <span class="gl-profile__chevron" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>
              </span>
            </a>

            <a href="#/funds" class="gl-profile__link">
              <span class="gl-profile__link-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 4l8 4-8 4-8-4 8-4z"/><path d="M4 13l8 4 8-4"/><path d="M4 17l8 4 8-4"/></svg>
              </span>
              <span>กองทุนและงบประมาณ</span>
              <span class="gl-profile__chevron" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>
              </span>
            </a>

            <a href="#/members" class="gl-profile__link">
              <span class="gl-profile__link-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/></svg>
              </span>
              <span>ทะเบียนสมาชิกและการถวาย</span>
              <span class="gl-profile__chevron" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>
              </span>
            </a>
          </div>
        </div>

        <!-- Security and Account Actions -->
        <div class="gl-card gl-profile__card gl-profile__card--tight">
          <div class="kicker" style="margin-bottom: var(--space-3);">ความปลอดภัยและการเข้าใช้งาน</div>
          <div style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: var(--text-sm);">
              <span>การยืนยันตัวตน</span>
              <span style="color: var(--income); font-weight: var(--weight-medium);">PIN 6 หลักพร้อมใช้งาน</span>
            </div>
            <div style="height: 1px; background: var(--border); margin: var(--space-1) 0;"></div>
            <button type="button" class="gl-btn gl-btn--secondary gl-profile__logout" data-logout>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
                <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>
              </svg>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  public attachEventListeners(_root: HTMLElement, _onNavigate: () => void): void {
    // Event listeners if any interactive elements are added
  }
}
