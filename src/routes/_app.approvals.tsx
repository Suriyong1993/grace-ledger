/**
 * /approvals — Approval Workflow Page
 *
 * แสดงรายการ Income + Expense ที่มีสถานะ "pending"
 * เหรัญญิก/Admin สามารถ Approve หรือ Reject ได้จากหน้านี้
 *
 * Design: Trust-first, Human Approval workflow
 * - รายการแต่ละรายการต้องอ่านข้อมูลครบก่อน approve
 * - Reject ต้องระบุเหตุผลเสมอ (Audit Trail)
 * - ทุก action มี confirmation step
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ArrowDownLeft,
  ArrowUpLeft,
  AlertTriangle,
  Users2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { InlineStatBar } from "@/components/shared/InlineStatBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { listIncome, listExpense } from "@/services/church";
import {
  apiApproveIncome,
  apiRejectIncome,
  apiApproveExpense,
  apiRejectExpense,
} from "@/services/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Income, Expense } from "@/lib/types";
import { useAuth } from "@/lib/auth";

/** Above this, JournalService requires dual super_admin approval — see src/server/auth/permissions.ts APPROVAL_THRESHOLDS */
const DUAL_APPROVAL_THRESHOLD = 50000;

export const Route = createFileRoute("/_app/approvals")({
  head: () => ({
    meta: [{ title: "รออนุมัติ — Grace Ledger" }],
  }),
  component: ApprovalsPage,
});

/* ── Combined pending item type ── */
type PendingKind = "income" | "expense";
interface PendingItem {
  id: string;
  kind: PendingKind;
  date: string;
  amount: number;
  description?: string;
  categoryId?: string;
  fundId?: string;
  createdBy: string;
  vendor?: string;
}

function toPending(items: Income[] | Expense[], kind: PendingKind): PendingItem[] {
  return (items as (Income & Expense)[])
    .filter((i) => i.status === "pending")
    .map((i) => ({
      id: i.id,
      kind,
      date: i.date,
      amount: i.amount,
      description: i.description,
      categoryId: i.categoryId,
      fundId: i.fundId,
      createdBy: i.createdBy,
      vendor: kind === "expense" ? i.vendor : undefined,
    }));
}

/* ── Reject Dialog ── */
interface RejectDialogProps {
  open: boolean;
  item: PendingItem | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

function RejectDialog({ open, item, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" strokeWidth={2} />
            ปฏิเสธรายการ
          </DialogTitle>
          <DialogDescription>
            กรุณาระบุเหตุผลในการปฏิเสธ — เหตุผลนี้จะถูกบันทึกใน Audit Trail
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p className="font-medium text-foreground">
              {item.kind === "income" ? "รายรับ" : "รายจ่าย"} — <MoneyText value={item.amount} />
            </p>
            {item.description && <p className="mt-0.5 text-muted-foreground">{item.description}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="kicker" htmlFor="reject-reason">
            เหตุผล (จำเป็น)
          </label>
          <Textarea
            id="reject-reason"
            placeholder="เช่น ใบเสร็จไม่ครบ, จำนวนเงินไม่ตรง, ต้องการข้อมูลเพิ่มเติม…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason.trim() || loading}
            className="active-press"
          >
            {loading ? "กำลังบันทึก…" : "ยืนยันการปฏิเสธ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Approve Confirm Dialog ── */
interface ApproveDialogProps {
  open: boolean;
  item: PendingItem | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function ApproveDialog({ open, item, onClose, onConfirm }: ApproveDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-approved">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
            อนุมัติรายการ
          </DialogTitle>
          <DialogDescription>
            ยืนยันการอนุมัติรายการนี้ — ไม่สามารถย้อนกลับได้หากไม่มีผู้ดูแลระบบ
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="rounded-lg border border-approved/20 bg-approved-muted/50 p-3 text-sm">
            <p className="font-semibold text-foreground">
              {item.kind === "income" ? "รายรับ" : "รายจ่าย"} — วันที่ {fmtDate(item.date)}
            </p>
            <p className="mt-1 num-display text-lg font-bold amount-income">
              <MoneyText value={item.amount} />
            </p>
            {item.description && <p className="mt-1 text-muted-foreground">{item.description}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-approved text-approved-foreground hover:bg-approved/90 active-press"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" strokeWidth={2} />
            {loading ? "กำลังบันทึก…" : "ยืนยันการอนุมัติ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Bulk Approve Confirm Dialog ── */
interface BulkApproveDialogProps {
  items: PendingItem[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function BulkApproveDialog({ items, onClose, onConfirm }: BulkApproveDialogProps) {
  const [loading, setLoading] = useState(false);
  const total = items.reduce((s, i) => s + (i.kind === "income" ? i.amount : -i.amount), 0);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={items.length > 0} onOpenChange={() => !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-approved">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
            อนุมัติ {items.length} รายการ
          </DialogTitle>
          <DialogDescription>
            ยืนยันการอนุมัติทุกรายการที่เลือก — ไม่สามารถย้อนกลับได้หากไม่มีผู้ดูแลระบบ
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-approved/20 bg-approved-muted/50 p-3 text-sm">
          {items.map((it) => (
            <div key={`${it.kind}-${it.id}`} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-foreground">
                {it.kind === "income" ? "รายรับ" : "รายจ่าย"} · {it.description || fmtDate(it.date)}
              </span>
              <span
                className={cn(
                  "num-display shrink-0 font-semibold",
                  it.kind === "income" ? "amount-income" : "amount-expense",
                )}
              >
                <MoneyText value={it.amount} />
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          สุทธิ:{" "}
          <span className="num-display font-semibold text-foreground">
            <MoneyText value={total} />
          </span>
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-approved text-approved-foreground hover:bg-approved/90 active-press"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" strokeWidth={2} />
            {loading ? "กำลังบันทึก…" : `ยืนยันอนุมัติ ${items.length} รายการ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Pending Item Row ── */
interface PendingRowProps {
  item: PendingItem;
  onApprove: (item: PendingItem) => void;
  onReject: (item: PendingItem) => void;
  index: number;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (item: PendingItem) => void;
}

function PendingRow({
  item,
  onApprove,
  onReject,
  index,
  selectable,
  selected,
  onToggleSelect,
}: PendingRowProps) {
  const isIncome = item.kind === "income";
  const needsDualApproval = item.amount > DUAL_APPROVAL_THRESHOLD;

  return (
    <div
      className={cn(
        "card-ledger flex items-center gap-3 p-4 transition-all duration-200",
        selected && "border-primary/40 bg-primary/[0.03]",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(item)}
          aria-label="เลือกรายการนี้"
        />
      )}

      {/* Kind icon */}
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
          isIncome ? "bg-income-muted" : "bg-expense-muted",
        )}
      >
        {isIncome ? (
          <ArrowDownLeft className="h-5 w-5 text-income" strokeWidth={1.75} />
        ) : (
          <ArrowUpLeft className="h-5 w-5 text-expense" strokeWidth={1.75} />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {isIncome ? "รายรับ" : "รายจ่าย"}
          </span>
          {item.vendor && <span className="text-xs text-muted-foreground">{item.vendor}</span>}
          {needsDualApproval && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              <Users2 className="h-3 w-3" strokeWidth={2} />
              ต้องอนุมัติ 2 คน
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          {fmtDate(item.date)} · บันทึกโดย {item.createdBy}
        </p>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "num-display text-base font-bold",
            isIncome ? "amount-income" : "amount-expense",
          )}
        >
          {isIncome ? "+" : "-"}
          <MoneyText value={item.amount} />
        </p>
        <StatusBadge status="pending" variant="dot" className="mt-0.5" />
      </div>

      {/* Actions — always visible; the confirm dialog is where full detail + friction lives */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/10 active-press"
          onClick={() => onReject(item)}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          ปฏิเสธ
        </Button>
        <Button
          size="sm"
          className="bg-approved text-approved-foreground hover:bg-approved/90 active-press"
          onClick={() => onApprove(item)}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
          อนุมัติ
        </Button>
      </div>
    </div>
  );
}

/* ── Main Page ── */
function ApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [approveTarget, setApproveTarget] = useState<PendingItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const {
    data: incomeList = [],
    isLoading: incomeLoading,
    isError: incomeError,
    refetch: refetchIncome,
  } = useQuery({
    queryKey: ["income"],
    queryFn: listIncome,
  });

  const {
    data: expenseList = [],
    isLoading: expenseLoading,
    isError: expenseError,
    refetch: refetchExpense,
  } = useQuery({
    queryKey: ["expense"],
    queryFn: listExpense,
  });

  const pendingItems: PendingItem[] = [
    ...toPending(incomeList, "income"),
    ...toPending(expenseList, "expense"),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const isLoading = incomeLoading || expenseLoading;
  const isError = incomeError || expenseError;
  const keyOf = (it: PendingItem) => `${it.kind}-${it.id}`;
  const selectedItems = pendingItems.filter((it) => selectedKeys.has(keyOf(it)));

  function toggleSelect(item: PendingItem) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const k = keyOf(item);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  /* Approve mutation */
  const approveMutation = useMutation({
    mutationFn: async (item: PendingItem) => {
      if (item.kind === "income") {
        await apiApproveIncome(item.id);
      } else {
        await apiApproveExpense(item.id);
      }
    },
    onSuccess: (_data, item) => {
      toast.success(`อนุมัติ${item.kind === "income" ? "รายรับ" : "รายจ่าย"}เรียบร้อยแล้ว`);
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["expense"] });
      setApproveTarget(null);
    },
    onError: () => {
      toast.error("เกิดข้อผิดพลาด — ลองใหม่อีกครั้ง");
    },
  });

  /* Reject mutation */
  const rejectMutation = useMutation({
    mutationFn: async ({ item, reason }: { item: PendingItem; reason: string }) => {
      if (item.kind === "income") {
        await apiRejectIncome(item.id, reason);
      } else {
        await apiRejectExpense(item.id, reason);
      }
    },
    onSuccess: (_data, { item }) => {
      toast.success(`ปฏิเสธ${item.kind === "income" ? "รายรับ" : "รายจ่าย"}เรียบร้อยแล้ว`);
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["expense"] });
      setRejectTarget(null);
    },
    onError: () => {
      toast.error("เกิดข้อผิดพลาด — ลองใหม่อีกครั้ง");
    },
  });

  /* Access control check */
  const canApprove = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        kicker="Workflow"
        title="รออนุมัติ"
        description={
          pendingItems.length > 0
            ? `${pendingItems.length} รายการรอการตรวจสอบจากเหรัญญิก`
            : "ไม่มีรายการรออนุมัติในขณะนี้"
        }
      />

      {isError && (
        <div className="flex items-center justify-between gap-4 rounded-card border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              โหลดคิวอนุมัติไม่สำเร็จ — รายการที่แสดงอาจไม่ครบถ้วน
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchIncome();
              refetchExpense();
            }}
            className="shrink-0"
          >
            ลองใหม่
          </Button>
        </div>
      )}

      {/* Role warning */}
      {!canApprove && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>สิทธิ์ไม่เพียงพอ</AlertTitle>
          <AlertDescription>
            เฉพาะเหรัญญิกและผู้ดูแลระบบเท่านั้นที่สามารถอนุมัติหรือปฏิเสธรายการได้
            คุณสามารถดูรายการที่รอการอนุมัติได้เท่านั้น
          </AlertDescription>
        </Alert>
      )}

      {/* Summary bar */}
      {!isLoading && pendingItems.length > 0 && (
        <InlineStatBar
          items={[
            { label: "รายการทั้งหมด", value: String(pendingItems.length), tone: "default" },
            {
              label: "รายรับรออนุมัติ",
              value: String(pendingItems.filter((i) => i.kind === "income").length),
              tone: "success",
            },
            {
              label: "รายจ่ายรออนุมัติ",
              value: String(pendingItems.filter((i) => i.kind === "expense").length),
              tone: "danger",
            },
            {
              label: "ต้องอนุมัติ 2 คน",
              value: String(pendingItems.filter((i) => i.amount > DUAL_APPROVAL_THRESHOLD).length),
              icon: Users2,
              tone: "warning",
            },
          ]}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-ledger p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && pendingItems.length === 0 && (
        <div className="card-ledger flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-approved-muted">
            <CheckCircle2 className="h-7 w-7 text-approved" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-semibold text-foreground">ทุกอย่างเรียบร้อยแล้ว!</p>
            <p className="mt-1 text-sm text-muted-foreground">ไม่มีรายการที่รอการอนุมัติในขณะนี้</p>
          </div>
        </div>
      )}

      {/* Bulk action bar — appears once anything is selected */}
      {canApprove && selectedItems.length > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-card border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-xs font-medium text-foreground">
            เลือกแล้ว {selectedItems.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set())}>
              ยกเลิกเลือก
            </Button>
            <Button
              size="sm"
              className="bg-approved text-approved-foreground hover:bg-approved/90 active-press"
              onClick={() => setBulkApproving(true)}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} />
              อนุมัติที่เลือก
            </Button>
          </div>
        </div>
      )}

      {/* Pending list */}
      {!isLoading && pendingItems.length > 0 && (
        <div className="space-y-3">
          {pendingItems.map((item, i) => (
            <PendingRow
              key={`${item.kind}-${item.id}`}
              item={item}
              index={i}
              selectable={canApprove}
              selected={selectedKeys.has(keyOf(item))}
              onToggleSelect={toggleSelect}
              onApprove={(it) => canApprove && setApproveTarget(it)}
              onReject={(it) => canApprove && setRejectTarget(it)}
            />
          ))}
        </div>
      )}

      {/* Approve dialog */}
      <ApproveDialog
        open={!!approveTarget}
        item={approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={async () => {
          if (approveTarget) {
            await approveMutation.mutateAsync(approveTarget);
          }
        }}
      />

      {/* Reject dialog */}
      <RejectDialog
        open={!!rejectTarget}
        item={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (rejectTarget) {
            await rejectMutation.mutateAsync({ item: rejectTarget, reason });
          }
        }}
      />

      {/* Bulk approve dialog */}
      {bulkApproving && (
        <BulkApproveDialog
          items={selectedItems}
          onClose={() => setBulkApproving(false)}
          onConfirm={async () => {
            const results = await Promise.allSettled(
              selectedItems.map((it) => approveMutation.mutateAsync(it)),
            );
            const failed = results.filter((r) => r.status === "rejected").length;
            if (failed > 0) {
              toast.error(`อนุมัติไม่สำเร็จ ${failed} จาก ${selectedItems.length} รายการ`);
            } else {
              toast.success(`อนุมัติ ${selectedItems.length} รายการเรียบร้อยแล้ว`);
            }
            setSelectedKeys(new Set());
            setBulkApproving(false);
          }}
        />
      )}
    </div>
  );
}
