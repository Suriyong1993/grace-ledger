import { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml } from "../lib/format";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { formatDateThai, toUserMessage } from "../lib/format";
import { restoreFocusAfterRender } from "../lib/ui/focus";
import { CHURCH_NAME_TH } from "../lib/org";
import { MembersService } from "../lib/members/members-service";

export interface MemberRecord {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  group: string;
}

type GivingState = {
  status: "loading" | "loaded" | "denied" | "none" | "failed";
  total: Money;
  titheCount: number;
  lastGivenDate: string | null;
};

const ICON_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`;
const ICON_PLUS = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_CERT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`;
const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export class MembersPage {
  private searchQuery = "";
  private selectedMemberId: string | null = null;
  private isAddMemberModalOpen = false;
  private members: MemberRecord[] = [];
  private membersService: MembersService;
  private errorMessage: string | null = null;
  private successMessage: string | null = null;
  private formErrorMessage: string | null = null;
  private isLoading = false;
  private isSubmitting = false;
  // Per-member confidential giving history, loaded only on explicit detail view
  // (single-member lookup — never bulk-fetched, per the privacy design).
  private givingById: Record<string, GivingState> = {};

  constructor(
    private supabase: SupabaseClient<Database>,
    private churchId: string,
    private churchName: string = CHURCH_NAME_TH,
  ) {
    this.membersService = new MembersService(supabase);
  }

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const { data, error } = await (this.supabase.from("members") as any)
        .select(
          "id, full_name, email, phone, is_active, created_at, member_code",
        )
        .eq("church_id", this.churchId)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) {
        this.errorMessage = "ไม่สามารถโหลดข้อมูลสมาชิกได้ กรุณาลองใหม่อีกครั้ง";
        this.members = [];
        return;
      }

      if (data && Array.isArray(data)) {
        this.members = data.map((m: any) => ({
          id: m.id,
          code: m.member_code || "—",
          name: m.full_name || "สมาชิก",
          email: m.email || "—",
          phone: m.phone || "—",
          group: "—",
        }));
      } else {
        this.members = [];
      }
    } catch {
      this.errorMessage =
        "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
      this.members = [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Loads the confidential giving history for a single member via the
   * privacy-gated RPC. This is the only sanctioned path for giving data and
   * must never be called in bulk. Results are cached per member id.
   */
  public async loadGivingForMember(
    memberId: string,
    onStateChange: () => void,
  ): Promise<void> {
    const existing = this.givingById[memberId];
    // Only skip when the cached state is still authoritative: a successful
    // load or an in-flight request. "failed" and "denied" are retryable.
    if (existing && (existing.status === "loaded" || existing.status === "loading" || existing.status === "denied")) return;

    this.givingById[memberId] = {
      status: "loading",
      total: Money.zero(),
      titheCount: 0,
      lastGivenDate: null,
    };
    onStateChange();

    let records: any[];
    try {
      const { data, error } = await this.supabase.rpc(
        "get_member_giving_history",
        {
          p_member_id: memberId,
          p_reason: "ออกหนังสือรับรองการถวายทรัพย์",
        } as any,
      );

      if (error) {
        // The RPC itself rejected the call (role gate / justification) — a
        // genuine permission state, not a network problem.
        this.givingById[memberId] = {
          status: "denied",
          total: Money.zero(),
          titheCount: 0,
          lastGivenDate: null,
        };
        onStateChange();
        return;
      }
      records = (data as any[]) || [];

      // records already extracted above
      const currentYear = new Date().getFullYear();
      const thisYear = records.filter((r) => {
        const d = r.given_at ? new Date(r.given_at) : null;
        return d && d.getFullYear() === currentYear;
      });

      if (thisYear.length === 0) {
        this.givingById[memberId] = {
          status: "none",
          total: Money.zero(),
          titheCount: 0,
          lastGivenDate: null,
        };
      } else {
        const total = thisYear.reduce(
          (acc, r) => acc.add(Money.from(r.amount || "0.00")),
          Money.zero(),
        );
        const titheCount = thisYear.filter(
          (r) => r.giving_type === "tithe",
        ).length;
        const last = thisYear
          .map((r) => (r.given_at ? new Date(r.given_at) : null))
          .filter((d): d is Date => d !== null)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        this.givingById[memberId] = {
          status: "loaded",
          total,
          titheCount,
          lastGivenDate: last ? formatDateThai(last.toISOString()) : null,
        };
      }
    } catch {
      // Transport/network failure — the RPC never answered, so this is not a
      // permission state. Say so honestly and let the user retry.
      this.givingById[memberId] = {
        status: "failed",
        total: Money.zero(),
        titheCount: 0,
        lastGivenDate: null,
      };
    } finally {
      onStateChange();
    }
  }

  private givingBlockHtml(member: MemberRecord | null): string {
    if (!member) return "";
    const g = this.givingById[member.id];
    let body: string;
    if (!g || g.status === "loading") {
      body = `<div style="font-size: var(--text-xs); color: var(--muted-foreground);">กำลังโหลดประวัติการถวาย...</div>`;
    } else if (g.status === "denied") {
      body = `<div style="font-size: var(--text-xs); color: var(--expense);">ไม่มีสิทธิ์ดูข้อมูลการถวาย</div>`;
    } else if (g.status === "failed") {
      body = `<div style="font-size: var(--text-xs); color: var(--muted-foreground); display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
        ดูข้อมูลไม่สำเร็จ
        <button type="button" class="btn-retry-giving gl-btn gl-btn--secondary gl-btn--sm" data-member-id="${escapeHtml(member.id)}">ลองใหม่</button>
      </div>`;
    } else if (g.status === "none") {
      body = `<div style="font-size: var(--text-xs); color: var(--muted-foreground);">ไม่มีข้อมูลการถวายในปีนี้</div>`;
    } else {
      body = `
        <div style="margin-bottom: var(--space-2);"><strong>ชื่อผู้ถวาย:</strong> ${escapeHtml(member.name)} (รหัส: ${escapeHtml(member.code)})</div>
        <div style="margin-bottom: var(--space-2);"><strong>สถิติการถวายสิบลด:</strong> ${g.titheCount} ครั้ง</div>
        <div style="margin-bottom: var(--space-2);"><strong>ยอดถวายสะสมรวม:</strong> <span class="num-display" style="font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--primary);">${g.total.format()}</span></div>
        <div style="margin-bottom: var(--space-2);"><strong>ถวายล่าสุด:</strong> ${g.lastGivenDate ?? "—"}</div>
        <div class="no-print" style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: var(--space-3);">ประวัติการเข้าดูถูกบันทึกในบันทึกการตรวจสอบ</div>`;
    }
    return body;
  }

  public renderHtml(): string {
    const errorNoticeHtml = this.errorMessage
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${escapeHtml(this.errorMessage)}</span>
            <button id="retry-members-btn" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
          </div>
        </div>`
      : "";

    const successNoticeHtml = this.successMessage
      ? `<div class="gl-notice gl-notice--success" role="status" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body">${escapeHtml(this.successMessage)}</div>
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

    // Certificate Modal
    const certModalHtml = selectedMember
      ? `
      <div id="cert-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content gl-rise" style="max-width: 520px; padding: var(--space-5);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);" class="no-print">
            <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">หนังสือรับรองการถวายทรัพย์</div>
            <button id="close-cert-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          <div id="printable-certificate" style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card); padding: var(--space-6); margin-bottom: var(--space-4);">
            <div style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: var(--space-3); margin-bottom: var(--space-4);">
              <div style="font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--primary);">${escapeHtml(this.churchName)}</div>
              <div style="font-size: var(--text-base); font-weight: var(--weight-semibold); margin-top: var(--space-2);">หนังสือรับรองการบริจาค/การถวายทรัพย์</div>
              <div style="font-size: var(--text-xs); color: var(--muted-foreground);">ประจำปีภาษี ${new Date().getFullYear() + 543} / ${new Date().getFullYear()}</div>
            </div>

            <div style="text-align: left; font-size: var(--text-sm); line-height: 1.8; color: var(--foreground);">
              ${this.givingBlockHtml(selectedMember)}
            </div>

            <div style="margin-top: var(--space-6); display: flex; justify-content: space-between; text-align: center; font-size: var(--text-xs); color: var(--muted-foreground); padding-top: var(--space-4); border-top: 1px dashed var(--border);">
              <div>
                <div style="margin-bottom: 30px;">( ............................................................ )</div>
                <div>เหรัญญิกคริสตจักร</div>
              </div>
              <div>
                <div style="margin-bottom: 30px;">( ............................................................ )</div>
                <div>ศิษยาภิบาล / ประธานคริสตจักร</div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: var(--space-2);" class="no-print">
            <button id="print-cert-btn" class="gl-btn gl-btn--primary" style="flex: 1;">พิมพ์เอกสาร / ดาวน์โหลด PDF</button>
          </div>
        </div>
      </div>`
      : "";

    // Add Member Modal
    const addMemberModalHtml = this.isAddMemberModalOpen
      ? `
      <div id="add-member-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content gl-rise" style="max-width: 440px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">เพิ่มสมาชิกใหม่</div>
            <button id="close-add-member-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          ${
            this.formErrorMessage
              ? `<div class="gl-notice gl-notice--error" style="margin-bottom: var(--space-3); font-size: var(--text-xs);">
                  <div class="gl-notice__body">${escapeHtml(this.formErrorMessage)}</div>
                </div>`
              : ""
          }

          <form id="add-member-form" style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div class="gl-field">
              <label class="gl-label" for="member-name-input">ชื่อ-นามสกุล *</label>
              <input type="text" class="gl-input" id="member-name-input" required placeholder="เช่น สมเกียรติ วงศ์สว่าง" />
            </div>

            <div class="gl-field">
              <label class="gl-label" for="member-phone-input">เบอร์โทรศัพท์</label>
              <input type="tel" class="gl-input" id="member-phone-input" placeholder="เช่น 081-234-5678" />
            </div>

            <div class="gl-field">
              <label class="gl-label" for="member-email-input">อีเมล</label>
              <input type="email" class="gl-input" id="member-email-input" placeholder="เช่น somkiat@example.com" />
            </div>

            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
              <button type="button" id="cancel-add-member-btn" class="gl-btn gl-btn--secondary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>ยกเลิก</button>
              <button type="submit" class="gl-btn gl-btn--primary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "กำลังบันทึก…" : "บันทึกสมาชิก"}
              </button>
            </div>
          </form>
        </div>
      </div>`
      : "";

    const membersGridHtml = this.errorMessage
      ? ""
      : this.members.length === 0
        ? `<div class="gl-card gl-card--pad-lg gl-empty-center">
          <div class="gl-empty-center__icon" aria-hidden="true">${ICON_CERT}</div>
          <p class="gl-empty-center__msg">ยังไม่มีรายชื่อสมาชิก</p>
          <p class="gl-empty-center__hint">เพิ่มสมาชิกเพื่อบันทึกประวัติการถวายและออกหนังสือรับรองภาษี</p>
          <button id="empty-add-member-btn" class="gl-btn gl-btn--primary gl-btn--sm" style="margin-top: var(--space-3);">เพิ่มสมาชิกคนแรก</button>
        </div>`
        : filtered.length === 0
          ? `<div class="gl-card gl-card--pad-lg gl-empty-center">
          <p class="gl-empty-center__msg">ไม่พบสมาชิกที่ค้นหา</p>
          <p class="gl-empty-center__hint">ลองเปลี่ยนคำค้น หรือค้นหาด้วยชื่อ รหัส หรือกลุ่มแคร์</p>
          <button id="clear-member-search-btn" class="gl-btn gl-btn--secondary gl-btn--sm" style="margin-top: var(--space-3);">ล้างคำค้นหา</button>
        </div>`
        : `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-3);">
          ${filtered
            .map(
              (m) => `
            <div class="gl-card gl-member-card" style="display: flex; flex-direction: column; gap: var(--space-3);">
              <div style="display: flex; align-items: center; gap: var(--space-3);">
                <div aria-hidden="true" style="
                  width: var(--touch-target-min);
                  height: var(--touch-target-min);
                  border-radius: var(--radius-full);
                  background: var(--accent);
                  color: var(--accent-foreground);
                  display: grid;
                  place-items: center;
                  font-weight: var(--weight-bold);
                  font-size: var(--text-sm);
                ">${escapeHtml(m.name.slice(0, 2))}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: var(--text-base); font-weight: var(--weight-semibold);">${escapeHtml(m.name)}</div>
                  <div style="font-size: var(--text-xs); color: var(--muted-foreground);">${m.group} · ${m.code}</div>
                </div>
              </div>

              <div style="background: var(--secondary); border-radius: var(--radius-md); padding: var(--space-3);">
                <div style="font-size: var(--text-2xs); color: var(--muted-foreground);">ประวัติการถวายเป็นข้อมูลส่วนตัว</div>
                <div style="font-size: var(--text-xs); font-weight: var(--weight-medium); margin-top: 2px;">ดูรายละเอียดในหนังสือรับรอง</div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: var(--space-2);">
                <span style="font-size: var(--text-2xs); color: var(--muted-foreground);">อีเมล: ${escapeHtml(m.email)}</span>
                <button class="gl-btn gl-btn--secondary gl-btn--sm view-cert-btn" data-member-id="${m.id}">
                  ${ICON_CERT}
                  <span>หนังสือรับรอง</span>
                </button>
              </div>
            </div>`,
            )
            .join("")}
        </div>`;

    return `
    <div class="gl-page gl-fade-in">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap;">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <h1>สมาชิกและการถวาย</h1>
          <p>ทะเบียนสมาชิก ประวัติการถวายสิบลด และการออกหนังสือรับรองภาษี</p>
        </div>
        <button id="open-add-member-btn" class="gl-btn gl-btn--primary">
          ${ICON_PLUS}
          <span>เพิ่มสมาชิกใหม่</span>
        </button>
      </div>

      ${errorNoticeHtml}
      ${successNoticeHtml}

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
          <input id="member-search-input" type="text" aria-label="ค้นหาสมาชิก" value="${this.searchQuery}" placeholder="ค้นหาชื่อสมาชิก รหัส หรือกลุ่มแคร์..." style="
            flex: 1;
            border: none;
            background: transparent;
            font-size: var(--text-sm);
            color: var(--foreground);
            /* Keep the global :focus-visible ring — the one field users must type in. */
          " />
        </div>
      </section>

      <!-- Members Grid -->
      <section class="gl-section">
        ${membersGridHtml}
      </section>

      ${certModalHtml}
      ${addMemberModalHtml}
    </div>
    `;
  }

  public attachEventListeners(
    root: HTMLElement,
    onStateChange: () => void,
  ): void {
    root.querySelectorAll<HTMLButtonElement>(".btn-retry-giving").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-member-id");
        if (id) void this.loadGivingForMember(id, onStateChange);
      });
    });

    const retryBtn =
      root.querySelector<HTMLButtonElement>("#retry-members-btn");
    retryBtn?.addEventListener("click", async () => {
      await this.loadData();
      onStateChange();
    });

    const searchInput = root.querySelector<HTMLInputElement>(
      "#member-search-input",
    );
    searchInput?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      this.searchQuery = target.value;
      restoreFocusAfterRender(target, onStateChange);
    });

    const clearSearchBtn = root.querySelector<HTMLButtonElement>("#clear-member-search-btn");
    clearSearchBtn?.addEventListener("click", () => {
      this.searchQuery = "";
      onStateChange();
    });

    // Add Member Modal toggle
    const openAddMember = () => {
      this.isAddMemberModalOpen = true;
      this.formErrorMessage = null;
      this.successMessage = null;
      onStateChange();
    };

    root
      .querySelector<HTMLButtonElement>("#open-add-member-btn")
      ?.addEventListener("click", openAddMember);
    root
      .querySelector<HTMLButtonElement>("#empty-add-member-btn")
      ?.addEventListener("click", openAddMember);

    const closeAddMemberModal = () => {
      this.isAddMemberModalOpen = false;
      this.formErrorMessage = null;
      onStateChange();
    };

    root
      .querySelector<HTMLButtonElement>("#close-add-member-btn")
      ?.addEventListener("click", closeAddMemberModal);
    root
      .querySelector<HTMLButtonElement>("#cancel-add-member-btn")
      ?.addEventListener("click", closeAddMemberModal);
    const addMemberBackdrop =
      root.querySelector<HTMLElement>("#add-member-modal");
    addMemberBackdrop?.addEventListener("click", (e) => {
      if (e.target === addMemberBackdrop) closeAddMemberModal();
    });

    // Add Member Form submission
    const addMemberForm =
      root.querySelector<HTMLFormElement>("#add-member-form");
    addMemberForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput =
        root.querySelector<HTMLInputElement>("#member-name-input");
      const phoneInput = root.querySelector<HTMLInputElement>(
        "#member-phone-input",
      );
      const emailInput = root.querySelector<HTMLInputElement>(
        "#member-email-input",
      );

      const nameVal = nameInput?.value?.trim() || "";
      const phoneVal = phoneInput?.value?.trim() || undefined;
      const emailVal = emailInput?.value?.trim() || undefined;

      if (!nameVal) {
        this.formErrorMessage = "กรุณาระบุชื่อ-นามสกุลสมาชิก";
        onStateChange();
        return;
      }

      this.isSubmitting = true;
      this.formErrorMessage = null;
      onStateChange();

      try {
        const res = await this.membersService.createMember({
          church_id: this.churchId,
          full_name: nameVal,
          phone_number: phoneVal,
          email: emailVal,
        });

        if (!res.success) {
          this.formErrorMessage = res.error || "ไม่สามารถเพิ่มสมาชิกได้";
          this.isSubmitting = false;
          onStateChange();
          return;
        }

        this.isAddMemberModalOpen = false;
        this.successMessage = `เพิ่มสมาชิก "${nameVal}" เรียบร้อยแล้ว`;
        this.isSubmitting = false;
        await this.loadData();
        onStateChange();
      } catch (err: any) {
        this.formErrorMessage = toUserMessage(err, "เพิ่มสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง");
        this.isSubmitting = false;
        onStateChange();
      }
    });

    const certBtns = root.querySelectorAll<HTMLButtonElement>(".view-cert-btn");
    certBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-member-id");
        if (id) {
          this.selectedMemberId = id;
          // Trigger the privacy-gated single-member giving lookup.
          void this.loadGivingForMember(id, onStateChange);
          onStateChange();
        }
      });
    });

    const closeCertModal = () => {
      this.selectedMemberId = null;
      onStateChange();
    };

    const closeBtn = root.querySelector<HTMLButtonElement>("#close-cert-btn");
    closeBtn?.addEventListener("click", closeCertModal);

    const certBackdrop = root.querySelector<HTMLElement>("#cert-modal");
    certBackdrop?.addEventListener("click", (e) => {
      if (e.target === certBackdrop) closeCertModal();
    });

    const printBtn = root.querySelector<HTMLButtonElement>("#print-cert-btn");
    printBtn?.addEventListener("click", () => {
      // Print-isolation mode: only the certificate reaches the paper —
      // the member grid and page chrome behind the modal are hidden
      // by the `body.print-certificate` rules in app.css.
      document.body.classList.add("print-certificate");
      const cleanup = () => document.body.classList.remove("print-certificate");
      window.addEventListener("afterprint", cleanup, { once: true });
      window.print();
      window.setTimeout(cleanup, 1000);
    });
  }
}
