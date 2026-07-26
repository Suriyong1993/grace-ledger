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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <div className="space-y-6">
      {/* Header */}
      <Card className=" border-border/60 ">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">
              ใบนับเงิน & สรุปการถวายประจำวันอาทิตย์
            </CardTitle>
            <CardDescription className="text-xs">
              บันทึกยอดถวายรายบุคคล → นับธนบัตร → ตรวจสอบ → บันทึก
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className=" w-40 font-mono text-sm"
            />
            <Button variant="outline" className=" active:scale-95" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> พิมพ์
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="member-list" className="space-y-4">
        <TabsList className=" p-1 bg-muted/60">
          <TabsTrigger value="member-list" className="rounded-xl">
            <Users className="h-4 w-4 mr-2" /> 1. รายการถวายรายบุคคล
          </TabsTrigger>
          <TabsTrigger value="cash-count" className="rounded-xl">
            <Coins className="h-4 w-4 mr-2" /> 2. นับธนบัตรและเหรียญ
          </TabsTrigger>
          <TabsTrigger value="summary" className="rounded-xl">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> 3. สรุปยอด & ผู้นับเงิน
          </TabsTrigger>
          <TabsTrigger value="validation" className="rounded-xl">
            <ShieldCheck className="h-4 w-4 mr-2" /> 4. ตรวจสอบ & บันทึก
          </TabsTrigger>
        </TabsList>

        {/* ========== Tab 1: Member Matrix ========== */}
        <TabsContent value="member-list">
          <Card className="">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">1. บันทึกรายการถวายรายบุคคล</CardTitle>
                <CardDescription className="text-xs">
                  กรอกชื่อผู้ถวาย ใส่ยอดเงินแต่ละหมวด เลือกช่องทาง เงินสด/ออนไลน์
                </CardDescription>
              </div>
              <Button size="sm" onClick={addRow} className="rounded-xl active:scale-95">
                <Plus className="h-4 w-4 mr-1" /> เพิ่มรายชื่อ
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                    <th className="p-2.5 text-left min-w-[160px]">ชื่อผู้ถวาย</th>
                    <th className="p-2.5 text-right w-24">สิบลด</th>
                    <th className="p-2.5 text-right w-24">ค่าเช่า</th>
                    <th className="p-2.5 text-right w-24">อนุสรณ์</th>
                    <th className="p-2.5 text-right w-24">พันธกิจ</th>
                    <th className="p-2.5 text-right w-24">ถวายพิเศษ</th>
                    <th className="p-2.5 text-right w-24">ที่ดิน</th>
                    <th className="p-2.5 text-right w-24">ปาร์ตี้</th>
                    <th className="p-2.5 text-right w-28">รวม</th>
                    <th className="p-2.5 text-center w-28">ช่องทาง</th>
                    <th className="p-2.5 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.map((r) => {
                    const s = rowSum(r);
                    const hasAmountNoName = s > 0 && !r.name.trim();
                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${hasAmountNoName ? "bg-destructive/5" : "hover:bg-muted/30"}`}
                      >
                        <td className="p-2">
                          <Input
                            value={r.name}
                            onChange={(e) => updateRow(r.id, "name", e.target.value)}
                            placeholder="ชื่อผู้ถวาย..."
                            className={`h-8 rounded-lg text-xs ${hasAmountNoName ? "border-destructive/60" : ""}`}
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
                          <td key={field} className="p-2">
                            <Input
                              type="number"
                              value={r[field] || ""}
                              onChange={(e) => updateRow(r.id, field, Number(e.target.value))}
                              className="h-8 rounded-lg text-right font-mono text-xs"
                            />
                          </td>
                        ))}
                        <td className="p-2 text-right font-mono font-semibold text-primary">
                          {thb(s)}
                        </td>
                        <td className="p-2 text-center">
                          <select
                            value={r.channel}
                            onChange={(e) =>
                              updateRow(r.id, "channel", e.target.value as "cash" | "bank")
                            }
                            className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs"
                          >
                            <option value="cash">เงินสด</option>
                            <option value="bank">ออนไลน์</option>
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => removeRow(r.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/80 bg-muted/60 font-bold font-mono text-xs">
                    <td className="p-3">
                      ยอดรวม ({rows.filter((r) => rowSum(r) > 0).length} รายการ)
                    </td>
                    <td className="p-3 text-right">{thb(categoryTotals.tithe)}</td>
                    <td className="p-3 text-right">{thb(categoryTotals.rent)}</td>
                    <td className="p-3 text-right">{thb(categoryTotals.memorial)}</td>
                    <td className="p-3 text-right">{thb(categoryTotals.mission)}</td>
                    <td className="p-3 text-right">{thb(categoryTotals.special)}</td>
                    <td className="p-3 text-right">{thb(categoryTotals.land)}</td>
                    <td className="p-3 text-right">{thb(categoryTotals.party)}</td>
                    <td className="p-3 text-right text-primary text-sm">
                      {thb(categoryTotals.total)}
                    </td>
                    <td
                      colSpan={2}
                      className="p-3 text-center text-[11px] text-muted-foreground font-normal"
                    >
                      เงินสด: {thb(categoryTotals.cash)} | ออนไลน์: {thb(categoryTotals.online)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== Tab 2: Cash Count ========== */}
        <TabsContent value="cash-count">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 ">
              <CardHeader>
                <CardTitle className="text-base">
                  2. บันทึกข้อมูลการนับเงิน (ธนบัตรและเหรียญ)
                </CardTitle>
                <CardDescription className="text-xs">
                  ใส่จำนวนฉบับ/เหรียญที่นับได้จริง → ระบบคำนวณยอดเงินสดทั้งหมดให้อัตโนมัติ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {DENOMINATIONS.map((d) => {
                    const count = counts[d.value] || 0;
                    const subtotal = d.value * count;
                    return (
                      <div
                        key={d.value}
                        className="flex items-center justify-between p-3  border border-border/50 bg-card/60 "
                      >
                        <span className="text-sm font-medium w-28">{d.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">x</span>
                          <Input
                            type="number"
                            min="0"
                            value={count || ""}
                            onChange={(e) =>
                              setCounts((prev) => ({ ...prev, [d.value]: Number(e.target.value) }))
                            }
                            className="w-20 h-9 rounded-xl text-center font-mono font-semibold"
                          />
                        </div>
                        <span className="font-mono font-bold text-sm text-primary w-24 text-right">
                          {thb(subtotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Cash Reconciliation */}
            <div className="space-y-4">
              <Card className=" border-border/60 ">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" /> ยอดเงินสดทั้งหมด
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm font-mono">
                  <div className="flex justify-between p-3  bg-primary/10 border border-primary/30 text-primary font-bold text-base">
                    <span>เงินสดที่นับได้:</span>
                    <span>{thb(countedCashTotal)}</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl bg-muted/40">
                    <span className="text-muted-foreground">เงินสดจากใบถวาย:</span>
                    <span className="font-bold text-foreground">{thb(categoryTotals.cash)}</span>
                  </div>
                  <div
                    className={`flex justify-between p-3  border font-bold ${
                      cashDiff === 0
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600"
                        : "bg-destructive/15 border-destructive/40 text-destructive"
                    }`}
                  >
                    <span>กระทบยอด:</span>
                    <span>{cashDiff === 0 ? "✓ ตรงกันพอดี" : `ผลต่าง ${thb(cashDiff)}`}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ========== Tab 3: Summary ========== */}
        <TabsContent value="summary">
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base">3. บันทึกสรุปยอดประจำวัน & ผู้นับเงิน</CardTitle>
              <CardDescription className="text-xs">
                แยกยอดตามประเภท + สรุปเงินสด/ออนไลน์/รายรับ/รายจ่าย/คงเหลือ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground border-b pb-1">
                    สรุปยอดตามประเภท
                  </h4>
                  <div className="space-y-1.5 text-sm font-mono">
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
                        className="flex justify-between py-1.5 px-2 border-b border-border/30 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <span>{label}:</span>
                        <span
                          className={`font-semibold ${val > 0 ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {thb(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Channel + Income/Expense */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground border-b pb-1">
                    สรุปรายรับ / รายจ่าย
                  </h4>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between p-2.5 rounded-xl bg-muted/40">
                      <span>เงินสด:</span>
                      <span className="font-bold">{thb(categoryTotals.cash)}</span>
                    </div>
                    <div className="flex justify-between p-2.5 rounded-xl bg-muted/40">
                      <span>ออนไลน์:</span>
                      <span className="font-bold">{thb(categoryTotals.online)}</span>
                    </div>
                    <div className="flex justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/20 font-bold text-primary">
                      <span>รายรับรวม:</span>
                      <span>{thb(categoryTotals.total)}</span>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-sans font-medium text-muted-foreground">
                        รายจ่ายรวม:
                      </label>
                      <Input
                        type="number"
                        value={weeklyExpense || ""}
                        onChange={(e) => setWeeklyExpense(Number(e.target.value))}
                        placeholder="0"
                        className="rounded-xl font-mono text-sm"
                      />
                    </div>

                    <div
                      className={`flex justify-between p-3  border font-bold text-base ${
                        categoryTotals.total - weeklyExpense >= 0
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600"
                          : "bg-destructive/15 border-destructive/40 text-destructive"
                      }`}
                    >
                      <span>คงเหลือ:</span>
                      <span>{thb(categoryTotals.total - weeklyExpense)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Counter Signatures */}
              <div className="pt-4 border-t border-border/60">
                <h4 className="text-sm font-semibold text-foreground mb-3">ผู้นับเงิน (3 ท่าน)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: "ผู้นับเงินคนที่ 1", val: counter1, set: setCounter1 },
                    { label: "ผู้นับเงินคนที่ 2", val: counter2, set: setCounter2 },
                    { label: "ผู้นับเงินคนที่ 3", val: counter3, set: setCounter3 },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">
                        {label}
                      </label>
                      <Input
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder="ชื่อ-นามสกุล..."
                        className="rounded-xl text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== Tab 4: Validation & Save ========== */}
        <TabsContent value="validation">
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> 4. ตรวจสอบความถูกต้องก่อนบันทึก
              </CardTitle>
              <CardDescription className="text-xs">
                ระบบจะตรวจสอบข้อมูลทั้งหมดก่อนอนุญาตให้บันทึก ต้องผ่านทุกข้อจึงจะกดบันทึกได้
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Checklist */}
              <div className="space-y-3">
                {validationChecks.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-4  border transition-colors ${
                      c.pass
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-amber-500/10 border-amber-500/30"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        c.pass ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                      }`}
                    >
                      {c.pass ? "✓" : "!"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{c.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {c.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4  bg-muted/40 border border-border/40 font-mono text-sm">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">รายรับรวม</div>
                  <div className="font-bold text-primary text-base">
                    {thb(categoryTotals.total)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">เงินสด</div>
                  <div className="font-bold">{thb(categoryTotals.cash)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">ออนไลน์</div>
                  <div className="font-bold">{thb(categoryTotals.online)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">รายจ่าย</div>
                  <div className="font-bold text-destructive">{thb(weeklyExpense)}</div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex flex-col items-center gap-3 pt-2">
                {!allPassed && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    กรุณาแก้ไขรายการที่ยังไม่ผ่านก่อนบันทึก
                  </div>
                )}
                <Button
                  size="lg"
                  className=" px-8 py-6 text-base active:scale-95 disabled:opacity-50"
                  disabled={!allPassed || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {saveMutation.isPending ? "กำลังบันทึก..." : "ตรวจสอบผ่าน — บันทึกเข้าสู่ระบบ"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
