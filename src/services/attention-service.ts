import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { ApprovalsService } from "../lib/transactions/approvals-service";
import { TransactionsService } from "../lib/transactions/transactions-service";
import { OfferingService } from "../lib/offering/offering-service";
import { can, toUserRole, UserRole } from "../lib/rbac";
import { formatDateThai } from "../lib/format";
import { Money } from "../lib/money";

/** One actionable item inside an attention group. */
export interface AttentionItem {
  id: string;
  title: string;
  meta: string;
  href: string;
}

/** A role-filtered group of pending work (e.g. approvals, offering sessions). */
export interface AttentionGroup {
  key: "approvals" | "offerings" | "drafts";
  label: string;
  href: string;
  /** Group-level summary line: WHAT + WHY in one sentence. */
  summary: string;
  count: number;
  /** Attention styling on dashboards/panels when the group demands action. */
  requiresAction: boolean;
  items: AttentionItem[];
}

export interface AttentionSummary {
  groups: AttentionGroup[];
  totalCount: number;
  /** True when at least one permitted source failed to load. */
  loadFailed: boolean;
}

const OFFERING_ATTENTION_STATUSES = ["variance_review", "counted", "draft"] as const;

const OFFERING_STATUS_LABELS: Record<string, string> = {
  draft: "ร่างยังไม่เริ่มนับ",
  counted: "นับแล้ว รอยืนยัน",
  variance_review: "มีผลต่างรอดำเนินการ",
};

const DRAFT_LIMIT = 5;
const SESSION_LIMIT = 8;

/**
 * Aggregates the user's pending work from real domain sources — pending
 * approvals, offering sessions awaiting the next step, and draft
 * transactions — so the shell bell and the Dashboard "งานสัปดาห์นี้" section
 * render the same truth. Groups a role cannot read are never queried.
 */
export class AttentionService {
  private approvalsService: ApprovalsService;
  private transactionsService: TransactionsService;
  private offeringService: OfferingService;

  constructor(supabase: SupabaseClient<Database>) {
    this.approvalsService = new ApprovalsService(supabase);
    this.transactionsService = new TransactionsService(supabase);
    this.offeringService = new OfferingService(supabase);
  }

  public async load(churchId: string, rawRole: string | null | undefined): Promise<AttentionSummary> {
    const role: UserRole = toUserRole(rawRole);
    const groups: AttentionGroup[] = [];
    let loadFailed = false;

    const wantsApprovals = can(role, "read", "approvals");
    const wantsOfferings = can(role, "read", "offering_sessions");
    const wantsDrafts = can(role, "read", "transactions");

    const [approvalsRes, sessionsRes, draftsRes] = await Promise.allSettled([
      wantsApprovals ? this.approvalsService.getPendingApprovals(churchId) : Promise.resolve(null),
      wantsOfferings ? this.offeringService.listSessions(churchId) : Promise.resolve(null),
      wantsDrafts
        ? this.transactionsService.getTransactions(churchId, { status: "draft", limit: DRAFT_LIMIT })
        : Promise.resolve(null),
    ]);

    if (wantsApprovals) {
      const res = approvalsRes.status === "fulfilled" ? approvalsRes.value : null;
      const items = res && res.success && res.data ? res.data : [];
      if (!res || !res.success) loadFailed = true;
      const total = items.reduce((sum, item) => sum.add(item.amount), Money.zero());
      const latest = items[0];
      groups.push({
        key: "approvals",
        label: "คิวอนุมัติ",
        href: "#/approvals",
        summary: latest
          ? `${items.length} รายการ · รวม ${total.format()} · ล่าสุด ${latest.description || latest.referenceNumber || "คำขอเบิกจ่าย"}`
          : "ไม่มีคำขอค้างพิจารณา",
        count: items.length,
        requiresAction: items.length > 0,
        items: items.slice(0, DRAFT_LIMIT).map((item) => ({
          id: item.id,
          title: item.description || item.referenceNumber || "คำขอเบิกจ่าย",
          meta: `${item.amount.format()} · ${item.creatorName || "ไม่ระบุผู้ขอ"} · ${formatDateThai(item.createdAt)}`,
          href: "#/approvals",
        })),
      });
    }

    if (wantsOfferings) {
      const res = sessionsRes.status === "fulfilled" ? sessionsRes.value : null;
      const all = res && res.success && res.data ? res.data : [];
      if (!res || !res.success) loadFailed = true;
      const actionable = all
        .filter((s) => (OFFERING_ATTENTION_STATUSES as readonly string[]).includes(s.status))
        .sort((a, b) => (a.serviceDate < b.serviceDate ? 1 : -1))
        .slice(0, SESSION_LIMIT);
      const byStatus = (status: string) =>
        actionable.filter((s) => s.status === status).length;
      const varianceCount = byStatus("variance_review");
      const countedCount = byStatus("counted");
      const draftCount = byStatus("draft");
      const parts: string[] = [];
      if (varianceCount) parts.push(`ผลต่างรอดำเนินการ ${varianceCount}`);
      if (countedCount) parts.push(`รอยืนยัน ${countedCount}`);
      if (draftCount) parts.push(`ร่าง ${draftCount}`);
      const latest = actionable[0];
      groups.push({
        key: "offerings",
        label: "เงินถวาย",
        href: "#/offerings",
        summary: actionable.length
          ? `${parts.join(" · ")}${latest ? ` · ล่าสุด ${latest.serviceName} ${formatDateThai(latest.serviceDate)}` : ""}`
          : "ทุกรอบดำเนินการครบแล้ว",
        count: actionable.length,
        requiresAction: varianceCount > 0,
        items: actionable.map((s) => {
          const varianceNote =
            s.status === "variance_review" && s.cashVarianceAmount && !s.cashVarianceAmount.isZero()
              ? ` · ผลต่าง ${s.cashVarianceAmount.format()}`
              : "";
          return {
            id: s.id,
            title: `${s.serviceName} · ${formatDateThai(s.serviceDate)}`,
            meta: `${OFFERING_STATUS_LABELS[s.status] ?? s.status}${varianceNote}`,
            href: `#/offerings/${s.id}`,
          };
        }),
      });
    }

    if (wantsDrafts) {
      const res = draftsRes.status === "fulfilled" ? draftsRes.value : null;
      const drafts = res && res.success && res.data ? res.data : [];
      if (!res || !res.success) loadFailed = true;
      const latest = drafts[0];
      groups.push({
        key: "drafts",
        label: "ฉบับร่าง",
        href: "#/transactions",
        summary: drafts.length
          ? `${drafts.length} รายการยังไม่ส่งอนุมัติ${latest?.description ? ` · ล่าสุด ${latest.description}` : ""}`
          : "ไม่มีฉบับร่างค้าง",
        count: drafts.length,
        requiresAction: false,
        items: drafts.slice(0, DRAFT_LIMIT).map((t: any) => ({
          id: t.id,
          title: t.description || "รายการทั่วไป",
          meta: `${t.amount ? Money.from(t.amount as string).format() : "฿0.00"} · ${formatDateThai(t.transaction_date)}`,
          href: "#/transactions",
        })),
      });
    }

    const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
    return { groups, totalCount, loadFailed };
  }
}
