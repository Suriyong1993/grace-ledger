/**
 * DashboardGaugeChart.tsx
 *
 * Semi-circular Speedometer/Gauge Chart component for Annual Budget Usage
 * Inspired by the Storage Gauge in the 3-column reference design.
 * Features:
 * - SVG semi-circular arc with dynamic stroke-dasharray calculations
 * - Category spending distribution list with icons & percentages
 * - Clean Deep Slate + Violet-Indigo theme integration
 */

import { MoneyText } from "@/components/shared/MoneyText";
import { cn } from "@/lib/utils";
import { calculateGaugeArc, getGaugeStatusLabel } from "@/lib/gauge-utils";
import { Zap, HeartHandshake, Wrench, GraduationCap, Sparkles, PieChart } from "lucide-react";

interface CategorySpending {
  name: string;
  spent: number;
  percentage: number;
  icon: React.ElementType;
  colorClass: string;
}

interface DashboardGaugeChartProps {
  totalBudget: number;
  usedBudget: number;
  categories?: CategorySpending[];
}

const DEFAULT_CATEGORIES: CategorySpending[] = [
  {
    name: "ค่าสาธารณูปโภค",
    spent: 89000,
    percentage: 35,
    icon: Zap,
    colorClass: "text-offering",
  },
  {
    name: "พันธกิจ & มิชชันนารี",
    spent: 145000,
    percentage: 30,
    icon: HeartHandshake,
    colorClass: "text-primary",
  },
  {
    name: "ค่าซ่อมบำรุงอาคาร",
    spent: 34500,
    percentage: 20,
    icon: Wrench,
    colorClass: "text-income",
  },
  {
    name: "กิจกรรม & การศึกษา",
    spent: 22000,
    percentage: 15,
    icon: GraduationCap,
    colorClass: "text-muted-foreground",
  },
];

export function DashboardGaugeChart({
  totalBudget = 2500000,
  usedBudget = 1245600,
  categories = DEFAULT_CATEGORIES,
}: DashboardGaugeChartProps) {
  const gauge = calculateGaugeArc({ totalBudget, usedBudget });
  const { percentage, radius, strokeWidth, halfCircumference, strokeDashoffset } = gauge;

  return (
    <div className="card-ledger p-5 flex flex-col justify-between space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <div>
            <h3 className="font-semibold text-sm text-foreground">งบประมาณประจำปี</h3>
            <p className="text-[11px] text-muted-foreground">ปีงบประมาณปัจจุบัน</p>
          </div>
        </div>
        <span className="bg-muted text-muted-foreground text-[11px] px-2.5 py-0.5 font-medium rounded-full">
          {getGaugeStatusLabel(percentage)} ({percentage}%)
        </span>
      </div>

      {/* Speedometer Gauge Visual */}
      <div className="relative flex flex-col items-center justify-center pt-2">
        <svg className="w-48 h-28 overflow-visible" viewBox="0 0 180 100">
          {/* Background Arc Track */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-muted/60"
          />

          {/* Filled Progress Arc — single primary color */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={halfCircumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Text Overlay */}
        <div className="absolute top-10 text-center">
          <p className="num-display text-2xl font-bold tracking-tight text-foreground">
            {percentage}%
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            ใช้ไป <MoneyText value={usedBudget} />
          </p>
        </div>

        <p className="mt-1 text-xs text-muted-foreground font-medium">
          จากงบประมาณทั้งหมด <MoneyText value={totalBudget} />
        </p>
      </div>

      {/* Category Breakdown List */}
      <div className="space-y-2.5 pt-2 border-t border-border/60">
        <p className="kicker text-[11px]">สัดส่วนตามหมวดหมู่</p>
        <div className="space-y-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.name}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", cat.colorClass)} strokeWidth={1.75} />
                  <span className="text-xs font-medium text-foreground truncate">{cat.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="num-display text-xs font-semibold text-foreground">
                    <MoneyText value={cat.spent} />
                  </span>
                  <span className="ml-2 text-[10px] font-medium text-muted-foreground">
                    {cat.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Anomaly / Insight Footer Card */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-foreground">Grace AI Insight</p>
          <p className="text-muted-foreground text-[11px] mt-0.5 leading-normal">
            อัตราการใช้งบประมาณอยู่ในเกณฑ์ปกติ มีเงินสำรองสอดคล้องกับแผนการเงิน
          </p>
        </div>
      </div>
    </div>
  );
}
