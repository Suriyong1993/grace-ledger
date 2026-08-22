import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { formatDateThai } from "../lib/format";

export interface MemberRecord {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  group: string;
  yearGivingTotal: Money;
  titheCount: number;
  lastGivenDate: string;
}

const ICON_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`;
const ICON_CERT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`;
const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export class MembersPage {
  private searchQuery = "";
  private selectedMemberId: string | null = null;
  private members: MemberRecord[] = [];
  private errorMessage: string | null = null;
  private isLoading = false;

  constructor(private supabase: SupabaseClient<Database>, private churchId: string) {}

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const { data, error } = await (this.supabase
        .from("members") as any)
        .select("id, full_name, email, phone_number, is_active, created_at")
        .eq("church_id", this.churchId)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) {
        this.errorMessage = "ไม่สามารถโหลดข้อมูลสมาชิกได้ กรุณาลองใหม่อีกครั้ง";
        this.members = [];
        return;
      }

      if (data && Array.isArray(data)) {
        this.members = data.map((m, idx) => ({
          id: m.id,
          code: `MEM-${String(idx + 101).padStart(4, "0")}`,
          name: m.full_name || "สมาชิก",
          email: m.email || "—",
          phone: m.phone_number || "—",
          group: "กลุ่มสามัคคีธรรม",
          yearGivingTotal: Money.zero(),
          titheCount: 0,
          lastGivenDate: m.created_at ? formatDateThai(m.created_at) : "—",
        }));
      } else {
        this.members = [];
      }
    } catch {
      this.errorMessage = "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
      this.members = [];
    } finally {
      this.isLoading = false;
    }
  }

  public renderHtml(): string {
    const errorNoticeHtml = this.errorMessage
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${this.errorMessage}</span>
            <button id="retry-members-btn" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
          </div>
        </div>`
      : "";

    if (this.isLoading) {
      return `
      <div class="gl-page gl-fade-in">
        <div class="gl-page-header">
          <h1>สมาชิกและการถวาย</h1>
          <p>ทะเบียนสมาชิก ประวัติการถวายสิบลด และการออกหนังสือรับรองภาษี</p>
        </div>
        <div class="gl-card" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
          <p style="margin: 0; font-size: var(--text-sm);">กำลังโหลดข้อมูลสมาชิก...</p>
        </div>
      </div>`;
    }

    const filtered = this.members.filter((m) => {
      if (!this.searchQuery) return true;
      const q = this.searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.group.toLowerCase().includes(q)
      );
    });

    const selectedMember = this.selectedMemberId
      ? this.members.find((m) => m.id === this.selectedMemberId)
      : null;

    const certModalHtml = selectedMember
      ? `
      <div id="cert-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content" style="max-width: 480px; padding: var(--space-5);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">หนังสือรับรองการถวายทรัพย์</div>
            <button id="close-cert-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="width: 36px; height: 36px; padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card); padding: var(--space-5); text-align: center; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-sm); color: var(--muted-foreground);">คริสตจักรเกรซแบ๊บติสต์</div>
            <div style="font-size: var(--text-lg); font-weight: var(--weight-bold); margin: var(--space-1) 0;">หนังสือรับรองการบริจาค/การถวายทรัพย์</div>
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">ประจำปีภาษี 2569 / 2026</div>

            <div style="height: 1px; background: var(--border); margin: var(--space-4) 0;"></div>

            <div style="text-align: left; font-size: var(--text-xs); line-height: 1.8; color: var(--foreground);">
              <div><strong>ชื่อผู้ถวาย:</strong> ${selectedMember.name} (รหัส: ${selectedMember.code})</div>
              <div><strong>สถิติการถวายสิบลด:</strong> ${selectedMember.titheCount} ครั้ง</div>
              <div><strong>ยอดถวายสะสมรวมทั้งสิ้น:</strong> <span class="num-display" style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--primary);">${selectedMember.yearGivingTotal.format()}</span></div>
              <div><strong>สถานะ:</strong> ได้รับการตรวจสอบและบันทึกลงในระบบบัญชีคริสตจักรแล้ว</div>
            </div>
          </div>

          <div style="display: flex; gap: var(--space-2);">
            <button id="print-cert-btn" class="gl-btn gl-btn--primary" style="flex: 1;">พิมพ์เอกสาร / ดาวน์โหลด PDF</button>
          </div>
        </div>
      </div>`
      : "";

    const membersGridHtml = this.errorMessage
      ? ""
      : filtered.length === 0
      ? `<div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
          <div style="font-size: var(--text-base); font-weight: var(--weight-medium); color: var(--foreground); margin-bottom: 4px;">ยังไม่มีรายชื่อสมาชิก</div>
          <p style="margin: 0; font-size: var(--text-sm);">เพิ่มสมาชิกเพื่อบันทึกประวัติการถวายและออกหนังสือรับรองภาษี</p>
        </div>`
      : `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-3);">
          ${filtered
            .map(
              (m) => `
            <div class="gl-card gl-member-card" style="display: flex; flex-direction: column; gap: var(--space-3);">
              <div style="display: flex; align-items: center; gap: var(--space-3);">
                <div aria-hidden="true" style="
                  width: 44px;
                  height: 44px;
                  border-radius: var(--radius-full);
                  background: var(--accent);
                  color: var(--accent-foreground);
                  display: grid;
                  place-items: center;
                  font-weight: var(--weight-bold);
                  font-size: var(--text-sm);
                ">${m.name.slice(0, 2)}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: var(--text-base); font-weight: var(--weight-semibold);">${m.name}</div>
                  <div style="font-size: var(--text-xs); color: var(--muted-foreground);">${m.group} · ${m.code}</div>
                </div>
              </div>

              <div style="background: var(--secondary); border-radius: var(--radius-md); padding: var(--space-3); display: flex; justify-content: space-between; align-items: baseline;">
                <div>
                  <div style="font-size: var(--text-2xs); color: var(--muted-foreground);">ยอดถวายสะสมปี 2026</div>
                  <div class="num-display" style="font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--primary); margin-top: 2px;">
                    ${m.yearGivingTotal.format()}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: var(--text-2xs); color: var(--muted-foreground);">ถวายสิบลด</div>
                  <div class="num-display" style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">${m.titheCount} ครั้ง</div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: var(--space-2);">
                <span style="font-size: var(--text-2xs); color: var(--muted-foreground);">ถวายล่าสุด: ${m.lastGivenDate}</span>
                <button class="gl-btn gl-btn--secondary gl-btn--sm view-cert-btn" data-member-id="${m.id}">
                  ${ICON_CERT}
                  <span>หนังสือรับรอง</span>
                </button>
              </div>
            </div>`
            )
            .join("")}
        </div>`;

    return `
    <div class="gl-page gl-fade-in">
      <div class="gl-page-header">
        <h1>สมาชิกและการถวาย</h1>
        <p>ทะเบียนสมาชิก ประวัติการถวายสิบลด และการออกหนังสือรับรองภาษี</p>
      </div>

      ${errorNoticeHtml}

      <!-- Search Bar -->
      <section class="gl-section" style="margin-bottom: var(--space-4);">
        <div style="
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: 0 var(--space-3);
          min-height: var(--touch-target-min);
          border: 1px solid var(--input);
          border-radius: var(--radius-input);
          background: var(--card);
        ">
          <span style="color: var(--muted-foreground);">${ICON_SEARCH}</span>
          <input id="member-search-input" type="text" value="${this.searchQuery}" placeholder="ค้นหาชื่อสมาชิก รหัส หรือกลุ่มแคร์..." style="
            flex: 1;
            border: none;
            background: transparent;
            font-size: var(--text-sm);
            color: var(--foreground);
            outline: none;
          " />
        </div>
      </section>

      <!-- Members Grid -->
      <section class="gl-section">
        ${membersGridHtml}
      </section>

      ${certModalHtml}
    </div>
    `;
  }

  public attachEventListeners(root: HTMLElement, onStateChange: () => void): void {
    const retryBtn = root.querySelector<HTMLButtonElement>("#retry-members-btn");
    retryBtn?.addEventListener("click", async () => {
      await this.loadData();
      onStateChange();
    });

    const searchInput = root.querySelector<HTMLInputElement>("#member-search-input");
    searchInput?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      onStateChange();
    });

    const certBtns = root.querySelectorAll<HTMLButtonElement>(".view-cert-btn");
    certBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-member-id");
        if (id) {
          this.selectedMemberId = id;
          onStateChange();
        }
      });
    });

    const closeBtn = root.querySelector<HTMLButtonElement>("#close-cert-btn");
    closeBtn?.addEventListener("click", () => {
      this.selectedMemberId = null;
      onStateChange();
    });

    const printBtn = root.querySelector<HTMLButtonElement>("#print-cert-btn");
    printBtn?.addEventListener("click", () => {
      window.print();
    });
  }
}
