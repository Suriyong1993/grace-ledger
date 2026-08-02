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
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
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

/* ── Pending Item Row ── */
interface PendingRowProps {
  item: PendingItem;
  onApprove: (item: PendingItem) => void;
  onReject: (item: PendingItem) => void;
  index: number;
}

function PendingRow({ item, onApprove, onReject, index }: PendingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isIncome = item.kind === "income";

  return (
    <div
      className={cn("card-ledger overflow-hidden transition-all duration-200", "animate-fade-up")}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
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

        {/* Expand toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 h-9 w-9 text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Expanded: action buttons */}
      {expanded && (
        <div className="border-t border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              <FileText className="mr-1 inline h-3 w-3" />
              ตรวจสอบข้อมูลครบถ้วนก่อนอนุมัติ
            </p>
            <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
function ApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [approveTarget, setApproveTarget] = useState<PendingItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingItem | null>(null);

  const { data: incomeList = [], isLoading: incomeLoading } = useQuery({
    queryKey: ["income"],
    queryFn: listIncome,
  });

  const { data: expenseList = [], isLoading: expenseLoading } = useQuery({
    queryKey: ["expense"],
    queryFn: listExpense,
  });

  const pendingItems: PendingItem[] = [
    ...toPending(incomeList, "income"),
    ...toPending(expenseList, "expense"),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const isLoading = incomeLoading || expenseLoading;

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="card-subtle p-4">
            <p className="kicker">รายการทั้งหมด</p>
            <p className="mt-1 num-display text-2xl font-bold text-foreground">
              {pendingItems.length}
            </p>
          </div>
          <div className="card-subtle p-4">
            <p className="kicker">รายรับรออนุมัติ</p>
            <p className="mt-1 num-display text-2xl font-bold amount-income">
              {pendingItems.filter((i) => i.kind === "income").length}
            </p>
          </div>
          <div className="card-subtle p-4 col-span-2 sm:col-span-1">
            <p className="kicker">รายจ่ายรออนุมัติ</p>
            <p className="mt-1 num-display text-2xl font-bold amount-expense">
              {pendingItems.filter((i) => i.kind === "expense").length}
            </p>
          </div>
        </div>
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

      {/* Pending list */}
      {!isLoading && pendingItems.length > 0 && (
        <div className="space-y-3">
          {pendingItems.map((item, i) => (
            <PendingRow
              key={`${item.kind}-${item.id}`}
              item={item}
              index={i}
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
    </div>
  );
}
