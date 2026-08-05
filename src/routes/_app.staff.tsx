/**
 * FS-001 — Finance Staff Home
 *
 * Event-based "verb menu" home screen for finance staff. Sprint 2 HTML
 * prototype (UI validation only — see .claude/sprint-2-instructions.md):
 * mock data, no backend calls, no accounting terminology (Debit/Credit/
 * Journal/Ledger never appear on this screen).
 *
 * The 4 action cards below feed the Record Income wizard (FS-002–FS-005)
 * and its siblings, none of which exist yet — clicking them surfaces a
 * "coming soon" toast rather than a broken route, so `npm run typecheck`
 * stays green until those screens are built.
 */

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { HandCoins, Receipt, Landmark, ArrowLeftRight, Inbox, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { TableSkeleton } from "@/components/shared/Skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TxStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/staff")({
  head: () => ({ meta: [{ title: "หน้าแรกเจ้าหน้าที่การเงิน — Grace Ledger" }] }),
  component: StaffHome,
});

type EventType = "income" | "expense" | "deposit" | "transfer";

interface EventAction {
  type: EventType;
  label: string;
  icon: LucideIcon;
  tone: "success" | "destructive" | "primary" | "info";
  comingSoonMessage: string;
}

const EVENT_ACTIONS: EventAction[] = [
  {
    type: "income",
    label: "รับเงิน",
    icon: HandCoins,
    tone: "success",
    comingSoonMessage: "ขั้นตอนบันทึกรับเงินกำลังจะเปิดใช้งานเร็ว ๆ นี้",
  },
  {
    type: "expense",
    label: "บันทึกรายจ่าย",
    icon: Receipt,
    tone: "destructive",
    comingSoonMessage: "ขั้นตอนบันทึกรายจ่ายกำลังจะเปิดใช้งานเร็ว ๆ นี้",
  },
  {
    type: "deposit",
    label: "ฝากธนาคาร",
    icon: Landmark,
    tone: "primary",
    comingSoonMessage: "ขั้นตอนฝากธนาคารกำลังจะเปิดใช้งานเร็ว ๆ นี้",
  },
  {
    type: "transfer",
    label: "โอนเงิน",
    icon: ArrowLeftRight,
    tone: "info",
    comingSoonMessage: "ขั้นตอนโอนเงินกำลังจะเปิดใช้งานเร็ว ๆ นี้",
  },
];

const TONE_CLASSES: Record<EventAction["tone"], string> = {
  success: "bg-success-muted text-success",
  destructive: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
};

const EVENT_LABEL: Record<EventType, string> = {
  income: "รับเงิน",
  expense: "รายจ่าย",
  deposit: "ฝากธนาคาร",
  transfer: "โอนเงิน",
};

interface RecentEvent {
  id: string;
  type: EventType;
  description: string;
  amount: number;
  status: TxStatus;
  timestamp: string;
}

/** Mock data — FS-001 is UI validation only, no backend call. */
const MOCK_RECENT_EVENTS: RecentEvent[] = [
  {
    id: "evt-1",
    type: "income",
    description: "ถวายวันอาทิตย์",
    amount: 15000,
    status: "approved",
    timestamp: "2026-08-03 10:30",
  },
  {
    id: "evt-2",
    type: "expense",
    description: "ค่าไฟฟ้าอาคารคริสตจักร",
    amount: 3200,
    status: "pending",
    timestamp: "2026-08-02 14:15",
  },
  {
    id: "evt-3",
    type: "deposit",
    description: "นำฝากเงินสดเข้าธนาคาร",
    amount: 20000,
    status: "approved",
    timestamp: "2026-08-01 16:45",
  },
  {
    id: "evt-4",
    type: "transfer",
    description: "โอนเงินกองทุนพันธกิจ",
    amount: 5000,
    status: "approved",
    timestamp: "2026-07-31 09:20",
  },
  {
    id: "evt-5",
    type: "income",
    description: "ถวายพิเศษ — งานคริสต์มาส",
    amount: 8500,
    status: "pending",
    timestamp: "2026-07-30 11:00",
  },
];

function StaffHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Simulated async load — demonstrates the loading/loaded async-state
  // contract (DESIGN.md §12) even though the data here is static mock data.
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="เจ้าหน้าที่การเงิน"
        title={user?.name ? `สวัสดี, ${user.name}` : "ทำรายการวันนี้"}
        description="เลือกรายการที่ต้องการบันทึก ระบบจะพาไปทีละขั้นตอน"
      />

      {/* 4 event-based action cards — the entry point for FS-002–FS-005 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {EVENT_ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => {
              if (action.type === "income") {
                navigate({ to: "/record-income/step-1" });
              } else {
                toast.info(action.comingSoonMessage);
              }
            }}
            className="active-press hover-card-lift flex flex-col items-start gap-4 rounded-card border border-border bg-card p-5 text-left transition-colors"
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-lg",
                TONE_CLASSES[action.tone],
              )}
            >
              <action.icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="font-display text-base font-semibold leading-tight text-foreground">
              + {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Recent transactions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">รายการล่าสุด</h2>

        {isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : MOCK_RECENT_EVENTS.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="ยังไม่มีรายการ"
            description="เริ่มบันทึกรายการแรกได้ที่ปุ่มด้านบน"
          />
        ) : (
          <div className="card-ledger overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_RECENT_EVENTS.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">
                      {EVENT_LABEL[evt.type]}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{evt.description}</div>
                      <div className="text-xs text-muted-foreground/70">
                        {fmtDateTime(evt.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText
                        value={evt.amount}
                        tone={
                          evt.type === "income"
                            ? "income"
                            : evt.type === "expense"
                              ? "expense"
                              : "default"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={evt.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
