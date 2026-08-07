/**
 * PendingApprovalsCard.tsx
 *
 * Dashboard right-column preview of items awaiting approval:
 * count badge + up to 3 rows + link to the full approval queue.
 */

import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MoneyText } from "@/components/shared/MoneyText";

export interface PendingApprovalItem {
  id: string;
  kind: "income" | "expense";
  description: string;
  amount: number;
  meta: string;
}

interface PendingApprovalsCardProps {
  items: PendingApprovalItem[];
  count: number;
}

export function PendingApprovalsCard({ items, count }: PendingApprovalsCardProps) {
  const preview = items.slice(0, 3);

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">รอการอนุมัติ</h3>
        {count > 0 && (
          <span className="num-display rounded-full bg-warning-muted px-2 py-0.5 text-[11px] font-semibold text-warning">
            {count} รายการ
          </span>
        )}
      </div>

      {preview.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />
          <p className="text-xs text-muted-foreground">ไม่มีรายการค้างอนุมัติ</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {preview.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium leading-snug text-foreground">
                  {item.description}
                </p>
                <MoneyText value={item.amount} tone={item.kind} className="shrink-0 text-[13px]" />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.meta}</p>
            </div>
          ))}
        </div>
      )}

      <Link
        to="/approvals"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent"
      >
        ไปที่คิวอนุมัติ
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
