import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  Calculator,
  Users,
  Coins,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { thb } from "@/lib/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOffering, createExpense } from "@/services/church";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface MemberOfferingRow {
  id: string;
  name: string;
  tithe: number;
  rent: number;
  memorial: number;
  mission: number;
  special: number;
  land: number;
  party: number;
  channel: "cash" | "bank";
}

const DENOMINATIONS = [
  { value: 1000, label: "1,000 บาท" },
  { value: 500, label: "500 บาท" },
  { value: 100, label: "100 บาท" },
  { value: 50, label: "50 บาท" },
  { value: 20, label: "20 บาท" },
  { value: 10, label: "10 บาท" },
  { value: 5, label: "5 บาท" },
  { value: 2, label: "2 บาท" },
  { value: 1, label: "1 บาท" },
  { value: 0.5, label: "50 สตางค์" },
  { value: 0.25, label: "25 สตางค์" },
];

const emptyRow = (): MemberOfferingRow => ({
  id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
  name: "",
  tithe: 0,
  rent: 0,
  memorial: 0,
  mission: 0,
  special: 0,
  land: 0,
  party: 0,
  channel: "cash",
});

const rowSum = (r: MemberOfferingRow) =>
  r.tithe + r.rent + r.memorial + r.mission + r.special + r.land + r.party;

/** Editorial tab trigger — flat, sharp corners, no shadow or bounce */
const TAB_TRIGGER = "rounded-none text-xs data-[state=active]:shadow-none active:scale-100";

export function SundayCountSheet() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Tab 1: รายการถวายรายบุคคล — เริ่มต้นจากว่าง 1 แถว
  const [rows, setRows] = useState<MemberOfferingRow[]>([emptyRow()]);

  // Tab 2: ใบนับธนบัตรและเหรียญ
  const [counts, setCounts] = useState<Record<number, number>>({
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
    0.5: 0,
    0.25: 0,
  });

  // Tab 3: รายจ่ายประจำวัน + ยอดออนไลน์แยก + ผู้นับเงิน
  const [weeklyExpense, setWeeklyExpense] = useState(0);
  const [counter1, setCounter1] = useState(user?.name ?? "");
  const [counter2, setCounter2] = useState("");
  const [counter3, setCounter3] = useState("");

  // =====================
  //  คำนวณสรุปยอด
  // =====================
  const categoryTotals = useMemo(() => {
    const t = {
      tithe: 0,
      rent: 0,
      memorial: 0,
      mission: 0,
      special: 0,
      land: 0,
      party: 0,
      cash: 0,
      online: 0,
      total: 0,
    };
    for (const r of rows) {
      const s = rowSum(r);
      t.tithe += r.tithe;
      t.rent += r.rent;
      t.memorial += r.memorial;
      t.mission += r.mission;
      t.special += r.special;
      t.land += r.land;
      t.party += r.party;
      t.total += s;
      if (r.channel === "cash") t.cash += s;
      else t.online += s;
    }
    return t;
  }, [rows]);
  const countedCashTotal = useMemo(
    () => Object.entries(counts).reduce((s, [d, q]) => s + Number(d) * (q || 0), 0),
    [counts],
  );

  const cashDiff = countedCashTotal - categoryTotals.cash;

  // =====================
  //  ระบบตรวจสอบความถูกต้อง (4 ข้อ)
  // =====================
  const validationChecks = useMemo(() => {
    const checks: { label: string; pass: boolean; detail: string }[] = [];

    // 1. ตรวจรายชื่อ: ต้องมีอย่างน้อย 1 แถวที่มียอด > 0 และมีชื่อ
    const filledRows = rows.filter((r) => rowSum(r) > 0);
    const noNameRows = filledRows.filter((r) => !r.name.trim());
    checks.push({
      label: "ไม่มีรายการตกหล่น (ชื่อผู้ถวาย)",
      pass: filledRows.length > 0 && noNameRows.length === 0,
      detail:
        filledRows.length === 0
          ? "ยังไม่มีรายการถวาย"
          : noNameRows.length > 0
            ? `มี ${noNameRows.length} แถวที่มียอดเงินแต่ยังไม่ได้ใส่ชื่อ`
            : `${filledRows.length} รายการ — ครบถ้วน`,
    });

    // 2. ไม่มีข้อมูลซ้ำ (ชื่อซ้ำ + ช่องทางเดียวกัน)
    const keys = filledRows.map((r) => `${r.name.trim().toLowerCase()}|${r.channel}`);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    checks.push({
      label: "ไม่มีข้อมูลซ้ำ (ชื่อ + ช่องทาง)",
      pass: dupes.length === 0,
      detail: dupes.length === 0 ? "ไม่พบรายการซ้ำ" : `พบ ${dupes.length} รายการซ้ำ`,
    });

    // 3. เงินสดจากการนับธนบัตร = ยอดเงินสดจากใบถวาย
    const hasCashEntries = categoryTotals.cash > 0;
    const cashCountDone = countedCashTotal > 0 || categoryTotals.cash === 0;
    checks.push({
      label: "เงินสดนับจริง ตรงกับยอดเงินสดจากใบถวาย",
      pass: cashDiff === 0 && cashCountDone,
      detail: !hasCashEntries
        ? "ไม่มีรายรับเงินสด (ข้ามการตรวจ)"
        : !cashCountDone
          ? "ยังไม่ได้กรอกจำนวนธนบัตร/เหรียญ"
          : cashDiff === 0
            ? `ตรงกัน ${thb(countedCashTotal)}`
            : `ผลต่าง ${thb(cashDiff)} (นับได้ ${thb(countedCashTotal)} / ใบถวาย ${thb(categoryTotals.cash)})`,
    });

    // 4. เงินสด + ออนไลน์ = รายรับรวม
    const channelSum = categoryTotals.cash + categoryTotals.online;
    checks.push({
      label: "เงินสด + ออนไลน์ = รายรับรวม",
      pass: channelSum === categoryTotals.total,
      detail:
        channelSum === categoryTotals.total
          ? `${thb(categoryTotals.cash)} + ${thb(categoryTotals.online)} = ${thb(categoryTotals.total)}`
          : `ผลรวมไม่ตรง: ${thb(channelSum)} ≠ ${thb(categoryTotals.total)}`,
    });

    return checks;
  }, [rows, categoryTotals, countedCashTotal, cashDiff]);

  const allPassed = validationChecks.every((c) => c.pass);

  // =====================
  //  จัดการแถว
  // =====================
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const updateRow = (id: string, field: keyof MemberOfferingRow, val: string | number) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));

  // =====================
  //  บันทึกข้อมูล
  // =====================
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึก");
      if (!allPassed) throw new Error("กรุณาตรวจสอบความถูกต้องให้ผ่านทุกข้อก่อนบันทึก");

      for (const r of rows) {
        if (rowSum(r) === 0) continue;
        const catMap = [
          { catId: "cat-tithe", amt: r.tithe },
          { catId: "cat-rent", amt: r.rent },
          { catId: "cat-memorial", amt: r.memorial },
          { catId: "cat-mission", amt: r.mission },
          { catId: "cat-special", amt: r.special },
          { catId: "cat-land", amt: r.land },
          { catId: "cat-party", amt: r.party },
        ];
        for (const c of catMap) {
          if (c.amt > 0) {
            await createOffering(
              {
                date,
                categoryId: c.catId,
                amount: c.amt,
                channel: r.channel === "cash" ? "cash" : "bank",
                fundId: "f1",
                note: `ถวายโดย: ${r.name || "ไม่ระบุชื่อ"} | ผู้นับ: ${[counter1, counter2, counter3].filter(Boolean).join(", ")}`,
              },
              user,
            );
          }
        }
      }

      if (weeklyExpense > 0) {
        await createExpense(
          {
            date,
            categoryId: "c-oth-e",
            amount: weeklyExpense,
            fundId: "f1",
            description: `รายจ่ายประจำวันอาทิตย์ (${date})`,
            status: "approved",
          },
          user,
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offering"] });
      qc.invalidateQueries({ queryKey: ["income"] });
      qc.invalidateQueries({ queryKey: ["expense"] });
      qc.invalidateQueries({ queryKey: ["funds"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("บันทึกข้อมูลประจำวันอาทิตย์และอัปเดตรายงานสำเร็จ!");
      // Reset form
      setRows([emptyRow()]);
      setCounts({
        1000: 0,
        500: 0,
        100: 0,
        50: 0,
        20: 0,
        10: 0,
        5: 0,
        2: 0,
        1: 0,
        0.5: 0,
        0.25: 0,
      });
      setWeeklyExpense(0);
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  // =====================
  //  UI
  // =====================
  return (
    <div className="space-y-5">
      {/* Header — ledger sheet title band */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="kicker">ประจำวันอาทิตย์</p>
          <h2 className="font-display mt-1.5 text-lg font-semibold tracking-tight text-foreground">
            ใบนับเงิน &amp; สรุปการถวาย
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            บันทึกยอดถวายรายบุคคล → นับธนบัตร → ตรวจสอบ → บันทึก
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="num-display h-8 w-40 text-sm"
          />
          <Button variant="outline" className="h-8" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> พิมพ์
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="member-list">
        <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-none">
          <TabsTrigger value="member-list" className={TAB_TRIGGER}>
            <Users className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> 1. รายการถวายรายบุคคล
          </TabsTrigger>
          <TabsTrigger value="cash-count" className={TAB_TRIGGER}>
            <Coins className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> 2. นับธนบัตรและเหรียญ
          </TabsTrigger>
          <TabsTrigger value="summary" className={TAB_TRIGGER}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> 3. สรุปยอด &amp;
            ผู้นับเงิน
          </TabsTrigger>
          <TabsTrigger value="validation" className={TAB_TRIGGER}>
            <ShieldCheck className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> 4. ตรวจสอบ &amp; บันทึก
          </TabsTrigger>
        </TabsList>

        {/* ========== Tab 1: Member Matrix ========== */}
        <TabsContent value="member-list" className="mt-5">
          <section className="card-ledger">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div>
                <p className="kicker">ขั้นตอนที่ 1 · รายการถวายรายบุคคล</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  กรอกชื่อผู้ถวาย ยอดเงินแต่ละหมวด และเลือกช่องทางเงินสด/ออนไลน์
                </p>
              </div>
              <Button size="sm" className="h-8" onClick={addRow}>
                <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> เพิ่มรายชื่อ
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="min-w-[160px] px-3 py-2.5 pl-5 text-left font-medium">
                      ชื่อผู้ถวาย
                    </th>
                    <th className="w-24 px-1.5 py-2.5 text-right font-medium">สิบลด</th>
                    <th className="w-24 px-1.5 py-2.5 text-right font-medium">ค่าเช่า</th>
                    <th className="w-24 px-1.5 py-2.5 text-right font-medium">อนุสรณ์</th>
                    <th className="w-24 px-1.5 py-2.5 text-right font-medium">พันธกิจ</th>
                    <th className="w-24 px-1.5 py-2.5 text-right font-medium">ถวายพิเศษ</th>
                    <th className="w-24 px-1.5 py-2.5 text-right font-medium">ที่ดิน</th>
                    <th className="w-24 px-1.5 py-2.5 text-right font-medium">ปาร์ตี้</th>
                    <th className="w-28 px-2 py-2.5 text-right font-medium">รวม</th>
                    <th className="w-28 px-2 py-2.5 text-center font-medium">ช่องทาง</th>
                    <th className="w-12 px-2 py-2.5 pr-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => {
                    const s = rowSum(r);
                    const hasAmountNoName = s > 0 && !r.name.trim();
                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${
                          hasAmountNoName ? "bg-destructive/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="px-2 py-2 pl-3">
                          <Input
                            value={r.name}
                            onChange={(e) => updateRow(r.id, "name", e.target.value)}
                            placeholder="ชื่อผู้ถวาย..."
                            className={`h-8 text-xs ${hasAmountNoName ? "border-destructive" : ""}`}
                          />
                        </td>
                        {(
                          [
                            "tithe",
                            "rent",
                            "memorial",
                            "mission",
                            "special",
                            "land",
                            "party",
                          ] as const
                        ).map((field) => (
                          <td key={field} className="px-1.5 py-2">
                            <Input
                              type="number"
                              value={r[field] || ""}
                              onChange={(e) => updateRow(r.id, field, Number(e.target.value))}
                              className="num-display h-8 text-right text-xs"
                            />
                          </td>
                        ))}
                        <td className="num-display px-2 py-2 text-right text-xs font-semibold text-foreground">
                          {thb(s)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <select
                            value={r.channel}
                            onChange={(e) =>
                              updateRow(r.id, "channel", e.target.value as "cash" | "bank")
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="cash">เงินสด</option>
                            <option value="bank">ออนไลน์</option>
                          </select>
                        </td>
                        <td className="px-2 py-2 pr-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-destructive/10"
                            onClick={() => removeRow(r.id)}
                            aria-label="ลบแถว"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" strokeWidth={1.75} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="num-display border-t border-border bg-muted/40 text-xs">
                    <td className="px-3 py-3 pl-5 font-medium text-muted-foreground">
                      ยอดรวม ({rows.filter((r) => rowSum(r) > 0).length} รายการ)
                    </td>
                    <td className="px-1.5 py-3 text-right font-semibold">
                      {thb(categoryTotals.tithe)}
                    </td>
                    <td className="px-1.5 py-3 text-right font-semibold">
                      {thb(categoryTotals.rent)}
                    </td>
                    <td className="px-1.5 py-3 text-right font-semibold">
                      {thb(categoryTotals.memorial)}
                    </td>
                    <td className="px-1.5 py-3 text-right font-semibold">
                      {thb(categoryTotals.mission)}
                    </td>
                    <td className="px-1.5 py-3 text-right font-semibold">
                      {thb(categoryTotals.special)}
                    </td>
                    <td className="px-1.5 py-3 text-right font-semibold">
                      {thb(categoryTotals.land)}
                    </td>
                    <td className="px-1.5 py-3 text-right font-semibold">
                      {thb(categoryTotals.party)}
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-semibold text-foreground">
                      {thb(categoryTotals.total)}
                    </td>
                    <td
                      colSpan={2}
                      className="px-3 py-3 pr-5 text-center text-[11px] font-normal text-muted-foreground"
                    >
                      เงินสด {thb(categoryTotals.cash)} · ออนไลน์ {thb(categoryTotals.online)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </TabsContent>

        {/* ========== Tab 2: Cash Count ========== */}
        <TabsContent value="cash-count" className="mt-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="card-ledger lg:col-span-2">
              <div className="border-b border-border px-5 py-3.5">
                <p className="kicker">ขั้นตอนที่ 2 · ใบนับธนบัตรและเหรียญ</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ใส่จำนวนฉบับ/เหรียญที่นับได้จริง ระบบคำนวณยอดเงินสดให้อัตโนมัติ
                </p>
              </div>
              {/* Ledger column headings */}
              <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <span className="w-28">ชนิดราคา</span>
                <span className="flex-1 text-center">จำนวน</span>
                <span className="w-28 text-right">เป็นเงิน</span>
              </div>
              <div className="divide-y divide-border">
                {DENOMINATIONS.map((d, index) => {
                  const count = counts[d.value] || 0;
                  const subtotal = d.value * count;
                  return (
                    <div key={d.value} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="num-display w-28 shrink-0 text-sm font-medium text-foreground">
                        {d.label}
                      </span>
                      <div className="flex flex-1 items-center justify-center gap-2.5">
                        <span aria-hidden className="text-xs text-muted-foreground">
                          ×
                        </span>
                        <Input
                          type="number"
                          min="0"
                          id={`denom-input-${index}`}
                          value={count || ""}
                          onChange={(e) =>
                            setCounts((prev) => ({ ...prev, [d.value]: Number(e.target.value) }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const nextInput = document.getElementById(`denom-input-${index + 1}`);
                              if (nextInput) {
                                (nextInput as HTMLInputElement).focus();
                                (nextInput as HTMLInputElement).select();
                              }
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              const prevInput = document.getElementById(`denom-input-${index - 1}`);
                              if (prevInput) {
                                (prevInput as HTMLInputElement).focus();
                                (prevInput as HTMLInputElement).select();
                              }
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              const nextInput = document.getElementById(`denom-input-${index + 1}`);
                              if (nextInput) {
                                (nextInput as HTMLInputElement).focus();
                                (nextInput as HTMLInputElement).select();
                              }
                            }
                          }}
                          className="num-display h-8 w-20 text-center text-sm focus:ring-2 focus:ring-primary/50"
                        />
                        <span aria-hidden className="text-xs text-muted-foreground">
                          =
                        </span>
                      </div>
                      <span
                        className={`num-display w-28 shrink-0 text-right text-sm font-semibold ${
                          subtotal > 0 ? "text-foreground" : "text-muted-foreground/50"
                        }`}
                      >
                        {thb(subtotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Sheet running total */}
              <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3.5">
                <span className="kicker">รวมเงินสดที่นับได้</span>
                <span className="num-display text-lg font-semibold tracking-tight text-foreground">
                  {thb(countedCashTotal)}
                </span>
              </div>
            </section>

            {/* Cash Reconciliation */}
            <section className="card-ledger self-start">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <p className="kicker">กระทบยอดเงินสด</p>
                <Calculator className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.75} />
              </div>
              <div className="px-5 py-5">
                <p className="kicker">เงินสดที่นับได้</p>
                <p className="num-display font-display mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {thb(countedCashTotal)}
                </p>
              </div>
              <div className="divide-y divide-border border-t border-border">
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">เงินสดจากใบถวาย</span>
                  <span className="num-display font-semibold text-foreground">
                    {thb(categoryTotals.cash)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted-foreground">ผลต่าง</span>
                  <span
                    className={`num-display font-semibold ${
                      cashDiff === 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {cashDiff === 0 ? "ตรงกันพอดี" : thb(cashDiff)}
                  </span>
                </div>
              </div>
              <div
                className={`border-t border-border px-5 py-3.5 ${
                  cashDiff === 0 ? "bg-muted/40" : "bg-destructive/5"
                }`}
              >
                <p
                  className={`flex items-center gap-2 text-xs font-medium ${
                    cashDiff === 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {cashDiff === 0 ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  )}
                  {cashDiff === 0
                    ? "ยอดเงินสดตรงกัน พร้อมบันทึก"
                    : `ยอดต่าง ${thb(Math.abs(cashDiff))} — ${
                        Math.abs(cashDiff) % 1000 === 0
                          ? `สงสัยธนบัตร 1,000฿ ขาด/เกิน ${Math.abs(cashDiff) / 1000} ฉบับ`
                          : Math.abs(cashDiff) % 500 === 0
                            ? `สงสัยธนบัตร 500฿ ขาด/เกิน ${Math.abs(cashDiff) / 500} ฉบับ`
                            : Math.abs(cashDiff) % 100 === 0
                              ? `สงสัยธนบัตร 100฿ ขาด/เกิน ${Math.abs(cashDiff) / 100} ฉบับ`
                              : "กรุณาทวนนับจำนวนธนบัตรอีกครั้ง"
                      }`}
                </p>
              </div>
            </section>
          </div>
        </TabsContent>

        {/* ========== Tab 3: Summary ========== */}
        <TabsContent value="summary" className="mt-5">
          <section className="card-ledger">
            <div className="border-b border-border px-5 py-3.5">
              <p className="kicker">ขั้นตอนที่ 3 · สรุปยอดประจำวัน &amp; ผู้นับเงิน</p>
              <p className="mt-1 text-xs text-muted-foreground">
                แยกยอดตามประเภท พร้อมสรุปเงินสด/ออนไลน์/รายจ่าย/คงเหลือ
              </p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
              {/* Category Breakdown */}
              <div>
                <p className="kicker border-b border-border bg-muted/30 px-5 py-2.5">
                  สรุปยอดตามประเภท
                </p>
                <div className="divide-y divide-border">
                  {[
                    { label: "สิบลด", val: categoryTotals.tithe },
                    { label: "ค่าเช่า", val: categoryTotals.rent },
                    { label: "อนุสรณ์", val: categoryTotals.memorial },
                    { label: "พันธกิจ", val: categoryTotals.mission },
                    { label: "ถวายพิเศษ", val: categoryTotals.special },
                    { label: "ที่ดิน", val: categoryTotals.land },
                    { label: "ปาร์ตี้", val: categoryTotals.party },
                    { label: "ออนไลน์", val: categoryTotals.online },
                  ].map(({ label, val }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-5 py-2.5 text-sm"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span
                        className={`num-display font-semibold ${
                          val > 0 ? "text-foreground" : "text-muted-foreground/50"
                        }`}
                      >
                        {thb(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Channel + Income/Expense */}
              <div>
                <p className="kicker border-b border-border bg-muted/30 px-5 py-2.5">
                  สรุปรายรับ / รายจ่าย
                </p>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-muted-foreground">เงินสด</span>
                    <span className="num-display font-semibold text-foreground">
                      {thb(categoryTotals.cash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-muted-foreground">ออนไลน์</span>
                    <span className="num-display font-semibold text-foreground">
                      {thb(categoryTotals.online)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-medium text-foreground">รายรับรวม</span>
                    <span className="num-display font-semibold text-primary">
                      {thb(categoryTotals.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="text-muted-foreground">รายจ่ายรวม</span>
                    <Input
                      type="number"
                      value={weeklyExpense || ""}
                      onChange={(e) => setWeeklyExpense(Number(e.target.value))}
                      placeholder="0"
                      className="num-display h-8 w-32 text-right text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3.5">
                  <span className="kicker">คงเหลือ</span>
                  <span
                    className={`num-display text-lg font-semibold tracking-tight ${
                      categoryTotals.total - weeklyExpense >= 0
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {thb(categoryTotals.total - weeklyExpense)}
                  </span>
                </div>
              </div>
            </div>

            {/* Counter Signatures */}
            <div className="border-t border-border">
              <p className="kicker border-b border-border bg-muted/30 px-5 py-2.5">
                ผู้นับเงิน (3 ท่าน)
              </p>
              <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-3">
                {[
                  { label: "ผู้นับเงินคนที่ 1", val: counter1, set: setCounter1 },
                  { label: "ผู้นับเงินคนที่ 2", val: counter2, set: setCounter2 },
                  { label: "ผู้นับเงินคนที่ 3", val: counter3, set: setCounter3 },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {label}
                    </label>
                    <Input
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder="ชื่อ-นามสกุล..."
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </TabsContent>

        {/* ========== Tab 4: Validation & Save ========== */}
        <TabsContent value="validation" className="mt-5">
          <section className="card-ledger">
            <div className="border-b border-border px-5 py-3.5">
              <p className="kicker">ขั้นตอนที่ 4 · ตรวจสอบความถูกต้องก่อนบันทึก</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ระบบตรวจสอบข้อมูลทั้งหมดก่อนบันทึก — ต้องผ่านทุกข้อจึงจะบันทึกได้
              </p>
            </div>
            {/* Checklist */}
            <div className="divide-y divide-border">
              {validationChecks.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  {c.pass ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    <p className="num-display mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      c.pass ? "text-success" : "text-warning"
                    }`}
                  >
                    {c.pass ? "ผ่าน" : "ต้องแก้ไข"}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Summary — stat band with hairline dividers */}
            <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
              <div className="bg-card px-5 py-4">
                <p className="kicker">รายรับรวม</p>
                <p className="num-display mt-1.5 text-base font-semibold tracking-tight text-primary">
                  {thb(categoryTotals.total)}
                </p>
              </div>
              <div className="bg-card px-5 py-4">
                <p className="kicker">เงินสด</p>
                <p className="num-display mt-1.5 text-base font-semibold tracking-tight text-foreground">
                  {thb(categoryTotals.cash)}
                </p>
              </div>
              <div className="bg-card px-5 py-4">
                <p className="kicker">ออนไลน์</p>
                <p className="num-display mt-1.5 text-base font-semibold tracking-tight text-foreground">
                  {thb(categoryTotals.online)}
                </p>
              </div>
              <div className="bg-card px-5 py-4">
                <p className="kicker">รายจ่าย</p>
                <p className="num-display mt-1.5 text-base font-semibold tracking-tight text-destructive">
                  {thb(weeklyExpense)}
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex flex-col items-center gap-3 border-t border-border px-5 py-6">
              {!allPassed && (
                <p className="flex items-center gap-2 text-sm font-medium text-warning">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                  กรุณาแก้ไขรายการที่ยังไม่ผ่านก่อนบันทึก
                </p>
              )}
              <Button
                size="lg"
                className="h-10 px-8"
                disabled={!allPassed || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
                {saveMutation.isPending ? "กำลังบันทึก..." : "ตรวจสอบผ่าน — บันทึกเข้าสู่ระบบ"}
              </Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
