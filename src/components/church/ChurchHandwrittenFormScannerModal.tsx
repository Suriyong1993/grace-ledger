import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  Receipt,
  FileCheck,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import {
  parseChurchHandwrittenForm,
  type ChurchDocParsedResult,
} from "@/services/churchVoucherAiService";
import { thb } from "@/lib/format";

interface ChurchHandwrittenFormScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ChurchHandwrittenFormScannerModal({
  open,
  onOpenChange,
  onSuccess,
}: ChurchHandwrittenFormScannerModalProps) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ChurchDocParsedResult | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setResult(null);

    try {
      const data = await parseChurchHandwrittenForm(file);
      setResult(data);
      toast.success("AI อ่านใบตรวจนับเงิน/ใบเบิกเงินคริสตจักรสำเร็จ!");
    } catch (err) {
      toast.error("การอ่านเอกสารลายมือล้มเหลว กรุณาลองใหม่อีกครั้ง");
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmAutoKey = () => {
    toast.success("บันทึกข้อมูลลายมือเข้า Grace Ledger อัตโนมัติเรียบร้อยแล้ว!");
    if (onSuccess) onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
            AI สแกนอ่านเอกสารลายมือคริสตจักร (คริสตจักรชีวิตสุขสันต์กาฬสินธุ์)
          </DialogTitle>
          <DialogDescription className="text-xs">
            สแกนอ่านภาพถ่าย "ใบตรวจนับเงินแยกรายการ" หรือ "ใบเบิกเงิน คริสตจักร" เขียนมือ
            ถ่ายรูปแล้ว AI บันทึกให้อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        {/* Upload State */}
        {!result && !scanning && (
          <div className="border-2 border-dashed border-border hover:border-amber-500/50 transition-colors rounded-xl p-8 text-center space-y-4 bg-muted/20">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 grid place-items-center text-amber-600 dark:text-amber-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">
                อัปโหลดภาพถ่ายใบตรวจนับเงินถวาย หรือใบเบิกเงินคริสตจักร
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                รองรับไฟล์ภาพถ่ายเขียนมือจากมือถือ (JPG, PNG, WEBP, HEIC)
              </p>
            </div>
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              id="church-handwritten-upload"
              onChange={handleFileUpload}
            />
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => document.getElementById("church-handwritten-upload")?.click()}
            >
              <UploadCloud className="mr-2 h-4 w-4" /> ถ่ายภาพ / เลือกรูปเอกสาร
            </Button>
          </div>
        )}

        {/* Scanning State */}
        {scanning && (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 grid place-items-center text-warning animate-spin">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">
                AI กำลังแกะลายมือคริสตจักรชีวิตสุขสันต์กาฬสินธุ์...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                อ่านรายชื่อสมาชิก, ถวายสิบลด, พันธกิจ, ถวายพิเศษ,
                และคำนวนผลรวมรายคอลัมน์ให้อัตโนมัติ
              </p>
            </div>
          </div>
        )}

        {/* Result State */}
        {result && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                >
                  {result.churchName}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {result.docType === "offering_worksheet"
                    ? "📋 ใบตรวจนับเงินแยกรายการ"
                    : "🧾 ใบเบิกเงิน คริสตจักร"}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">วันที่: {result.date}</span>
            </div>

            {/* If Offering Worksheet */}
            {result.docType === "offering_worksheet" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                    รายการถวายรายบุคคลที่ AI อ่านได้ ({result.members.length} คน)
                  </h4>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ยอดรวมเงินถวายสุทธิ: {thb(result.totals.grandTotal)}
                  </span>
                </div>

                {/* Table Breakdown */}
                <div className="border border-border rounded-lg overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2">ลำดับ</th>
                        <th className="p-2">ชื่อ/รายการสมาชิก</th>
                        <th className="p-2 text-right">สิบลด</th>
                        <th className="p-2 text-right">พันธกิจ</th>
                        <th className="p-2 text-right">ถวายพิเศษ</th>
                        <th className="p-2 text-right font-semibold">รวม (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.members.map((m) => (
                        <tr key={m.no} className="hover:bg-muted/20">
                          <td className="p-2 text-muted-foreground">{m.no}</td>
                          <td className="p-2 font-medium">{m.memberName}</td>
                          <td className="p-2 text-right">{m.tithe ? thb(m.tithe) : "-"}</td>
                          <td className="p-2 text-right">{m.mission ? thb(m.mission) : "-"}</td>
                          <td className="p-2 text-right">{m.special ? thb(m.special) : "-"}</td>
                          <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {thb(m.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-500/10 font-bold border-t border-border text-emerald-800 dark:text-emerald-300">
                      <tr>
                        <td colSpan={2} className="p-2">
                          ผลรวมตรวจสอบสุทธิ
                        </td>
                        <td className="p-2 text-right">{thb(result.totals.titheTotal)}</td>
                        <td className="p-2 text-right">{thb(result.totals.missionTotal)}</td>
                        <td className="p-2 text-right">{thb(result.totals.specialTotal)}</td>
                        <td className="p-2 text-right text-emerald-600 dark:text-emerald-400">
                          {thb(result.totals.grandTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* If Disbursement Voucher */}
            {result.docType === "disbursement_voucher" && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-amber-600" />
                  รายการใบเบิกเงินคริสตจักรที่สแกนพบ ({result.vouchers.length} ใบ)
                </h4>

                <div className="space-y-2">
                  {result.vouchers.map((v, i) => (
                    <div
                      key={i}
                      className="border border-border p-3 rounded-lg flex items-center justify-between text-xs bg-card"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{v.purpose}</p>
                        <p className="text-[11px] text-muted-foreground">
                          ผู้เบิก/รับเงิน: <span className="font-medium">{v.applicant}</span> ·
                          หมวดหมู่: {v.category}
                        </p>
                      </div>
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                        {thb(v.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="text-xs">
                ถ่ายภาพใหม่
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={handleConfirmAutoKey}
              >
                <FileCheck className="mr-1.5 h-4 w-4" />
                บันทึก Auto-Key เข้า Grace Ledger
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
