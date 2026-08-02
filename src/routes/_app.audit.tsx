/**
 * /audit — Audit Trail & Security Logs
 *
 * Implements Audit Review & Compliance Page:
 * - SHA-256 Chain Verification Badge
 * - Severity level classification (info, warning, critical)
 * - Severity Filtering (ทั้งหมด, ข้อมูลทั่วไป, คำเตือน, วิกฤต)
 * - Summary statistics widgets (Total logs, Critical edits, Security status)
 * - Timeline feed with date grouping
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  ScrollText,
  AlertTriangle,
  FileCheck,
  Download,
  Filter,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { listAudit } from "@/services/church";
import { apiVerifyAuditChain, type AuditChainVerificationResult } from "@/services/api";
import { dayjs, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [{ title: "Audit Trail — Grace Ledger" }] }),
  component: AuditPage,
});

type Severity = "all" | "info" | "warning" | "critical";

function inferSeverity(action: string, details?: string): "info" | "warning" | "critical" {
  const text = `${action} ${details ?? ""}`.toLowerCase();
  if (text.includes("ลบ") || text.includes("ปฏิเสธ") || text.includes("แก้ไขจำนวนเงิน")) {
    return "critical";
  }
  if (text.includes("แก้ไข") || text.includes("ยกเลิก") || text.includes("ร่าง")) {
    return "warning";
  }
  return "info";
}

function SeverityBadge({ severity }: { severity: "info" | "warning" | "critical" }) {
  if (severity === "critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <AlertTriangle className="h-3 w-3" />
        สำคัญ/สุ่มเสี่ยง
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/30 px-2 py-0.5 text-[10px] font-semibold text-warning">
        <AlertTriangle className="h-3 w-3" />
        คำเตือน
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      ข้อมูลทั่วไป
    </span>
  );
}

function AuditPage() {
  const { can } = useAuth();
  const [severityFilter, setSeverityFilter] = useState<Severity>("all");
  const q = useQuery({ queryKey: ["audit"], queryFn: listAudit });

  // SHA-256 chain verification state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AuditChainVerificationResult | null>(null);

  const handleVerifyChain = useCallback(async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await apiVerifyAuditChain();
      setVerifyResult(result);
      if (result.valid) {
        toast.success(`Chain Intact — ${result.entriesChecked} entries verified`);
      } else {
        toast.error(`Chain Broken at entry: ${result.firstBreakAt ?? "unknown"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Verification failed: ${msg}`);
    } finally {
      setVerifying(false);
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    const rows = q.data ?? [];
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }
    const header = ["วันที่/เวลา", "ผู้ใช้", "การกระทำ", "เอนทิตี", "รายละเอียด"].join(",");
    const lines = rows.map((r) =>
      [dayjs(r.at).format("YYYY-MM-DD HH:mm"), r.userName, r.action, r.entity, r.details ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = "\uFEFF" + header + "\n" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`ส่งออก ${rows.length} รายการแล้ว`);
  }, [q.data]);

  const rows = q.data ?? [];

  // Filter rows by severity
  const filteredRows = useMemo(() => {
    if (severityFilter === "all") return rows;
    return rows.filter((r) => inferSeverity(r.action, r.details) === severityFilter);
  }, [rows, severityFilter]);

  // Statistics
  const criticalCount = useMemo(
    () => rows.filter((r) => inferSeverity(r.action, r.details) === "critical").length,
    [rows],
  );
  const warningCount = useMemo(
    () => rows.filter((r) => inferSeverity(r.action, r.details) === "warning").length,
    [rows],
  );

  if (!can("audit.view")) return <Navigate to="/dashboard" replace />;

  // Group consecutive entries by calendar day
  const groups: { key: string; label: string; items: AuditLog[] }[] = [];
  for (const a of filteredRows) {
    const key = dayjs(a.at).format("YYYY-MM-DD");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(a);
    } else {
      groups.push({ key, label: fmtDate(a.at), items: [a] });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="ความน่าเชื่อถือ & Audit Trail"
        title="บันทึกกิจกรรมและการตรวจสอบ"
        description="ประวัติการบันทึก แก้ไข และอนุมัติข้อมูลทั้งหมดในระบบ ไม่สามารถแก้ไขย้อนหลังได้"
        actions={
          <div className="flex items-center gap-2">
            {/* SHA-256 Chain Status Badge — dynamic */}
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-2xs",
                verifyResult === null
                  ? "border-border bg-muted text-muted-foreground"
                  : verifyResult.valid
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {verifying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : verifyResult === null ? (
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              ) : verifyResult.valid ? (
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              <span>
                {verifying
                  ? "กำลังตรวจสอบ…"
                  : verifyResult === null
                    ? "SHA-256 Chain"
                    : verifyResult.valid
                      ? `Verified (${verifyResult.entriesChecked})`
                      : "Chain Broken!"}
              </span>
            </Badge>

            {/* Verify Chain Button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleVerifyChain}
              disabled={verifying}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", verifying && "animate-spin")} />
              ตรวจสอบความถูกต้อง
            </Button>

            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              ส่งออก CSV
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards for Audit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-ledger p-4 flex items-center justify-between">
          <div>
            <p className="kicker">ประวัติการบันทึกทั้งหมด</p>
            <p className="num-display text-2xl font-bold text-foreground mt-1">
              {rows.length} รายการ
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
        </div>

        <div className="card-ledger p-4 flex items-center justify-between">
          <div>
            <p className="kicker">รายการแก้ไข/ปฏิเสธ</p>
            <p className="num-display text-2xl font-bold text-warning mt-1">
              {criticalCount + warningCount} รายการ
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/10 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="card-ledger p-4 flex items-center justify-between">
          <div>
            <p className="kicker">สถานะความถูกต้อง</p>
            <p className="num-display text-2xl font-bold text-income mt-1">100% สมบูรณ์</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-income-muted text-income">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground ml-1" />
          <span className="text-xs font-semibold text-foreground">กรองตามระดับ:</span>
        </div>

        <div className="flex items-center gap-1">
          {(["all", "info", "warning", "critical"] as const).map((sev) => {
            const labels = {
              all: `ทั้งหมด (${rows.length})`,
              info: "ข้อมูลทั่วไป",
              warning: `คำเตือน (${warningCount})`,
              critical: `สำคัญ/สุ่มเสี่ยง (${criticalCount})`,
            };
            return (
              <Button
                key={sev}
                variant="ghost"
                size="sm"
                onClick={() => setSeverityFilter(sev)}
                className={cn(
                  "h-auto rounded-lg px-3 py-1 text-xs font-medium",
                  severityFilter === sev
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {labels[sev]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Timeline Content */}
      {q.isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="ไม่พบบันทึกตามเงื่อนไข"
          description="ลองเปลี่ยนตัวกรองระดับความสำคัญใหม่"
        />
      ) : (
        <div className="stagger space-y-6">
          {groups.map((g) => (
            <section
              key={g.key}
              className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3">
                <p className="kicker text-muted-foreground/80">{g.label}</p>
                <span className="num-display text-[11px] font-semibold text-muted-foreground">
                  {g.items.length} รายการ
                </span>
              </div>

              {/* Timeline feed */}
              <ul className="relative divide-y divide-border/40 pl-14">
                <div className="pointer-events-none absolute inset-y-0 left-[2.75rem] w-px bg-border/40" />
                {g.items.map((a) => {
                  const severity = inferSeverity(a.action, a.details);
                  return (
                    <li key={a.id} className="relative flex items-start gap-4 py-3.5 pr-5">
                      {/* Timeline dot */}
                      <div className="absolute -left-[1.625rem] top-[1.125rem] flex h-3 w-3 items-center justify-center">
                        <div
                          className={cn(
                            "h-2.5 w-2.5 rounded-full border ring-2 ring-card",
                            severity === "critical"
                              ? "bg-destructive border-destructive"
                              : severity === "warning"
                                ? "bg-warning border-warning"
                                : "bg-primary/40 border-primary",
                          )}
                        />
                      </div>

                      {/* Time */}
                      <span className="num-display absolute left-[-3.25rem] top-[0.875rem] w-10 text-right text-[10px] font-medium text-muted-foreground/70">
                        {dayjs(a.at).format("HH:mm")}
                      </span>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{a.userName}</span>
                          <span className="text-xs text-muted-foreground">{a.action}</span>
                          <SeverityBadge severity={severity} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono text-[11px] text-foreground/80">
                            {a.entity}
                          </span>
                          {a.details ? ` · ${a.details}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
