import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  approveIncome,
  listCategories,
  listExpense,
  listFunds,
  listIncome,
  listUsers,
  setExpenseStatus,
} from "@/services/church";
import { useAuth } from "@/lib/auth";
import { fmtDate, thb } from "@/lib/format";
import { STATUS_LABEL, type Expense, type Income, type TxStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/approvals")({
  head: () => ({ meta: [{ title: "ศูนย์อนุมัติ — Grace Ledger" }] }),
  component: ApprovalCenter,
});

/** Above this amount a transaction must be approved by a super_admin (dual approval). */
const SUPER_ADMIN_THRESHOLD = 50_000;

type Kind = "income" | "expense";
type Filter = "pending" | "all" | "income" | "expense";

const FILTER_TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "income", label: "รายรับ" },
  { id: "expense", label: "รายจ่าย" },
  { id: "pending", label: "รออนุมัติ" },
];

/** Statuses that belong to the approval workflow — drafts and voided entries never surface here. */
const WORKFLOW_STATUSES: TxStatus[] = ["pending", "approved", "rejected"];

interface ApprovalItem {
  id: string;
  kind: Kind;
  date: string;
  amount: number;
  status: TxStatus;
  categoryId: string;
  fundId: string;
  createdBy: string;
  description?: string;
  approvedBy?: string;
  vendor?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
}

function toItem(kind: Kind, tx: Income | Expense): ApprovalItem {
  return {
    id: tx.id,
    kind,
    date: tx.date,
    amount: tx.amount,
    status: tx.status,
    categoryId: tx.categoryId,
    fundId: tx.fundId,
    createdBy: tx.createdBy,
    description: tx.description,
    approvedBy: tx.approvedBy,
    vendor: "vendor" in tx ? tx.vendor : undefined,
    attachmentName: tx.attachmentName,
    attachmentType: tx.attachmentType,
    attachmentSize: tx.attachmentSize,
  };
}

function itemTitle(item: ApprovalItem) {
  return (
    item.description || item.vendor || (item.kind === "income" ? "รายรับทั่วไป" : "รายจ่ายทั่วไป")
  );
}

function fmtFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ApprovalCenter() {
  const { user, can, hasRole } = useAuth();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const refreshLedger = () => {
    qc.invalidateQueries({ queryKey: ["income"] });
    qc.invalidateQueries({ queryKey: ["expense"] });
  };

  const approve = useMutation({
    mutationFn: (item: ApprovalItem) =>
      item.kind === "income"
        ? approveIncome(item.id, user!)
        : setExpenseStatus(item.id, "approved", user!),
    onSuccess: () => {
      toast.success("อนุมัติรายการเรียบร้อย");
      setSelected(null);
      refreshLedger();
    },
    onError: (e: Error) => toast.error(e.message || "ไม่สามารถอนุมัติรายการได้"),
  });

  const reject = useMutation({
    mutationFn: ({ item, reason }: { item: ApprovalItem; reason: string }) =>
      setExpenseStatus(item.id, "rejected", user!, reason),
    onSuccess: () => {
      toast.success("ปฏิเสธรายการเรียบร้อย");
      setRejectTarget(null);
      setRejectReason("");
      setSelected(null);
      refreshLedger();
    },
    onError: (e: Error) => toast.error(e.message || "ไม่สามารถปฏิเสธรายการได้"),
  });

  const items = useMemo(() => {
    const all = [
      ...(incomeQ.data ?? []).map((i) => toItem("income", i)),
      ...(expenseQ.data ?? []).map((e) => toItem("expense", e)),
    ].filter((i) => WORKFLOW_STATUSES.includes(i.status));

    // Pending work floats to the top; everything else reads newest-first.
    return all.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "pending") return -1;
        if (b.status === "pending") return 1;
      }
      return b.date.localeCompare(a.date);
    });
  }, [incomeQ.data, expenseQ.data]);

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);

  const stats = useMemo(
    () => ({
      count: pending.length,
      amount: pending.reduce((s, i) => s + i.amount, 0),
      incomeCount: pending.filter((i) => i.kind === "income").length,
      expenseCount: pending.filter((i) => i.kind === "expense").length,
    }),
    [pending],
  );

  const visible = useMemo(
    () =>
      items.filter((i) => {
        if (filter === "income") return i.kind === "income";
        if (filter === "expense") return i.kind === "expense";
        if (filter === "pending") return i.status === "pending";
        return true;
      }),
    [items, filter],
  );

  const catName = (id: string) => catsQ.data?.find((c) => c.id === id)?.name ?? "ไม่ระบุหมวดหมู่";
  const fundName = (id: string) => fundsQ.data?.find((f) => f.id === id)?.name ?? "ไม่ระบุกองทุน";
  const userName = (id?: string) =>
    id ? (usersQ.data?.find((u) => u.id === id)?.name ?? id) : "—";

  const canApprove = (item: ApprovalItem) =>
    can(item.kind === "income" ? "income.approve" : "expense.approve");
  const needsSuperAdmin = (item: ApprovalItem) => item.amount > SUPER_ADMIN_THRESHOLD;
  const blockedByThreshold = (item: ApprovalItem) =>
    needsSuperAdmin(item) && !hasRole("super_admin");

  if (incomeQ.isError || expenseQ.isError) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="w-full max-w-md rounded-sm border border-border bg-card p-6 text-center shadow-craft">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-warning" strokeWidth={1.5} />
          <p className="font-display text-base font-semibold text-foreground">
            ไม่สามารถโหลดรายการที่รออนุมัติได้
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {(incomeQ.error as Error)?.message ||
              (expenseQ.error as Error)?.message ||
              "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 active-press cursor-pointer"
            onClick={() => {
              incomeQ.refetch();
              expenseQ.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> ลองใหม่อีกครั้ง
          </Button>
        </div>
      </div>
    );
  }

  if (incomeQ.isLoading || expenseQ.isLoading) {
    return (
      <PageTransition className="space-y-5 md:space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-sm" />
          <Skeleton className="h-7 w-64 rounded-sm" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Skeleton className="h-28 rounded-sm" />
          <Skeleton className="h-28 rounded-sm" />
          <Skeleton className="h-28 rounded-sm" />
          <Skeleton className="h-28 rounded-sm" />
        </div>
        <Skeleton className="h-9 w-72 rounded-sm" />
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-sm" />
          <Skeleton className="h-24 rounded-sm" />
          <Skeleton className="h-24 rounded-sm" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-5 md:space-y-6">
      <PageHeader
        kicker="Trust Workflow"
        title="ศูนย์อนุมัติ"
        description="ตรวจสอบและอนุมัติรายรับรายจ่ายทั้งหมดจากที่เดียว พร้อมเกณฑ์วงเงินและร่องรอยการตรวจสอบ"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 active-press cursor-pointer"
            onClick={refreshLedger}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>รีเฟรช</span>
          </Button>
        }
      />

      {/* ── Pending summary ─────────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col justify-between rounded-sm border border-border/80 bg-card p-4 shadow-craft transition-colors hover:bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="kicker">รายการรออนุมัติ</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-amber-500/10 text-warning">
              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          </div>
          <p className="num-display mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
            <NumberTicker value={stats.count} /> <span className="text-sm font-medium">รายการ</span>
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-sm border border-border/80 bg-card p-4 shadow-craft transition-colors hover:bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="kicker">มูลค่ารวมที่รออนุมัติ</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          </div>
          <p className="num-display mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
            ฿<NumberTicker value={stats.amount} decimalPlaces={2} />
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-sm border border-border/80 bg-card p-4 shadow-craft transition-colors hover:bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="kicker">รายรับรออนุมัติ</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-success/10 text-success">
              <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          </div>
          <p className="num-display mt-3 font-display text-2xl font-bold tracking-tight text-success">
            <NumberTicker value={stats.incomeCount} />{" "}
            <span className="text-sm font-medium">รายการ</span>
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-sm border border-border/80 bg-card p-4 shadow-craft transition-colors hover:bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="kicker">รายจ่ายรออนุมัติ</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          </div>
          <p className="num-display mt-3 font-display text-2xl font-bold tracking-tight text-destructive">
            <NumberTicker value={stats.expenseCount} />{" "}
            <span className="text-sm font-medium">รายการ</span>
          </p>
        </div>
      </section>

      {/* ── Filter tabs ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <p className="kicker">คิวการอนุมัติ</p>
        <div
          role="tablist"
          aria-label="ตัวกรองรายการอนุมัติ"
          className="flex items-center gap-1 rounded-sm border border-border bg-muted/30 p-0.5 text-xs"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                "min-h-11 rounded-[2px] px-3 font-medium transition-colors duration-150 cursor-pointer active-press",
                filter === tab.id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Approval cards ──────────────────────────────── */}
      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={filter === "pending" ? "ไม่มีรายการรออนุมัติ" : "ไม่พบรายการตามเงื่อนไข"}
          description={
            filter === "pending"
              ? "ทุกรายการได้รับการตรวจสอบเรียบร้อยแล้ว"
              : "ลองเลือกตัวกรองอื่นเพื่อดูรายการในคิวการอนุมัติ"
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => setSelected(item)}
              className="group flex w-full min-h-11 items-center justify-between gap-4 rounded-sm border border-border/80 bg-card p-4 text-left shadow-craft transition-colors duration-150 cursor-pointer active-press hover:bg-muted/20"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm",
                    item.kind === "income"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {item.kind === "income" ? (
                    <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                    {itemTitle(item)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="num-display">{fmtDate(item.date)}</span>
                    <span className="text-border/60">·</span>
                    <span>{catName(item.categoryId)}</span>
                    <span className="text-border/60">·</span>
                    <StatusBadge status={item.status} />
                  </div>
                  {needsSuperAdmin(item) && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-[2px] border border-amber-500/30 bg-amber-50/60 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                      <ShieldAlert className="h-3 w-3" strokeWidth={2} />
                      ต้องอนุมัติโดย Super Admin
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "num-display font-display text-lg font-bold tracking-tight",
                    item.kind === "income" ? "text-success" : "text-destructive",
                  )}
                >
                  {item.kind === "income" ? "+" : "−"}
                  {thb(item.amount)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/20 transition-colors group-hover:text-muted-foreground/60" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Detail sheet ────────────────────────────────── */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border p-6 text-left">
            <div className="flex items-center justify-between">
              <span className="kicker">รายละเอียดการอนุมัติ</span>
              {selected && <StatusBadge status={selected.status} />}
            </div>
            <SheetTitle className="mt-2 font-display text-xl font-semibold">
              {selected ? itemTitle(selected) : "รายการอนุมัติ"}
            </SheetTitle>
            <SheetDescription className="num-display text-xs text-muted-foreground">
              รหัสรายการ: {selected?.id}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="rounded-sm border border-border/60 bg-muted/20 p-5 text-center">
                <span className="kicker">จำนวนเงิน</span>
                <p
                  className={cn(
                    "num-display mt-1 font-display text-3xl font-bold tracking-tight",
                    selected.kind === "income" ? "text-success" : "text-destructive",
                  )}
                >
                  {selected.kind === "income" ? "+" : "−"}
                  {thb(selected.amount)}
                </p>
                {needsSuperAdmin(selected) && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="h-3 w-3" strokeWidth={2} />
                    ต้องอนุมัติโดย Super Admin
                  </p>
                )}
              </div>

              <div className="space-y-0 text-xs">
                {[
                  {
                    label: "ประเภทรายการ",
                    value: selected.kind === "income" ? "รายรับ" : "รายจ่าย",
                  },
                  { label: "วันที่ทำรายการ", value: fmtDate(selected.date) },
                  { label: "หมวดหมู่", value: catName(selected.categoryId) },
                  { label: "กองทุน", value: fundName(selected.fundId) },
                  ...(selected.vendor ? [{ label: "ผู้รับเงิน", value: selected.vendor }] : []),
                  { label: "ผู้บันทึก", value: userName(selected.createdBy) },
                  { label: "ผู้อนุมัติ", value: userName(selected.approvedBy) },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between gap-4 border-b border-border/40 py-2.5"
                  >
                    <span className="shrink-0 text-muted-foreground">{row.label}</span>
                    <span className="truncate font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Attachment */}
              <div>
                <p className="kicker mb-2">เอกสารแนบ</p>
                {selected.attachmentName ? (
                  <div className="flex items-center gap-3 rounded-sm border border-border/60 bg-muted/20 p-3">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {selected.attachmentName}
                      </p>
                      <p className="num-display mt-0.5 text-[11px] text-muted-foreground">
                        {selected.attachmentType ?? "ไม่ระบุชนิดไฟล์"}
                        {selected.attachmentSize
                          ? ` · ${fmtFileSize(selected.attachmentSize)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-sm border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                    ไม่มีเอกสารแนบสำหรับรายการนี้
                  </p>
                )}
              </div>

              {/* Workflow timeline */}
              <div>
                <p className="kicker mb-2">ลำดับขั้นการอนุมัติ</p>
                <ol className="space-y-3">
                  {[
                    { label: "บันทึกรายการ", done: true, meta: fmtDate(selected.date) },
                    {
                      label: STATUS_LABEL.pending,
                      done: true,
                      meta: `ต้องการผู้อนุมัติ ${needsSuperAdmin(selected) ? 2 : 1} คน`,
                    },
                    {
                      label:
                        selected.status === "rejected"
                          ? STATUS_LABEL.rejected
                          : STATUS_LABEL.approved,
                      done: selected.status === "approved" || selected.status === "rejected",
                      meta: selected.approvedBy ? userName(selected.approvedBy) : "รอดำเนินการ",
                    },
                  ].map((step) => (
                    <li key={step.label} className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          step.done ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      />
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-xs font-medium",
                            step.done ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{step.meta}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Actions */}
              {selected.status === "pending" && canApprove(selected) && (
                <div className="space-y-2 border-t border-border pt-5">
                  <Button
                    className="h-11 w-full gap-1.5 active-press cursor-pointer"
                    disabled={approve.isPending || blockedByThreshold(selected)}
                    onClick={() => approve.mutate(selected)}
                  >
                    <Check className="h-4 w-4" />
                    <span>อนุมัติรายการ</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11 w-full gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5 active-press cursor-pointer"
                    disabled={selected.kind === "income" || reject.isPending}
                    onClick={() => {
                      setRejectReason("");
                      setRejectTarget(selected);
                    }}
                  >
                    <X className="h-4 w-4" />
                    <span>ปฏิเสธรายการ</span>
                  </Button>

                  {blockedByThreshold(selected) && (
                    <p className="text-[11px] text-muted-foreground">
                      รายการเกิน {thb(SUPER_ADMIN_THRESHOLD)} ต้องให้ Super Admin อนุมัติ
                    </p>
                  )}
                  {selected.kind === "income" && (
                    <p className="text-[11px] text-muted-foreground">
                      รายรับไม่รองรับการปฏิเสธในระบบ — หากบันทึกผิดพลาดให้ลบรายการที่หน้ารายรับ
                    </p>
                  )}
                </div>
              )}

              {selected.status === "pending" && !canApprove(selected) && (
                <p className="border-t border-border pt-5 text-xs text-muted-foreground">
                  บัญชีของคุณไม่มีสิทธิ์อนุมัติรายการประเภทนี้
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Reject reason dialog ────────────────────────── */}
      <AlertDialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ปฏิเสธรายการนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              ระบุเหตุผลเพื่อบันทึกไว้ในร่องรอยการตรวจสอบ ผู้บันทึกรายการจะเห็นเหตุผลนี้
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="เช่น เอกสารแนบไม่ครบถ้วน"
            rows={4}
            className="rounded-sm"
          />

          <AlertDialogFooter>
            <AlertDialogCancel className="active-press cursor-pointer">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 active-press cursor-pointer"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => {
                if (rejectTarget)
                  reject.mutate({ item: rejectTarget, reason: rejectReason.trim() });
              }}
            >
              ยืนยันการปฏิเสธ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}
