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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCheck,
  RefreshCw,
  Share2,
  ExternalLink,
} from "lucide-react";
import { parseDocumentWithAI, type ParsedDocumentResult } from "@/services/aiReceiptService";
import { exportToPEAKCSV, syncToPEAKAPI } from "@/services/peakIntegrationService";
import { thb } from "@/lib/format";

interface SmartReceiptScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTransaction?: (data: ParsedDocumentResult) => void;
}

export function SmartReceiptScannerModal({
  open,
  onOpenChange,
  onApplyTransaction,
}: SmartReceiptScannerModalProps) {
  const [scanning, setScanning] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedDocumentResult | null>(null);
  const [peakSyncing, setPeakSyncing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setScanning(true);
    setParsedResult(null);

    try {
      const result = await parseDocumentWithAI(file);
      setParsedResult(result);
      toast.success("AI อ่านและวิเคราะห์เอกสารสำเร็จ!");
    } catch (err) {
      toast.error("การอ่านเอกสารล้มเหลว กรุณาลองใหม่อีกครั้ง");
    } finally {
      setScanning(false);
    }
  };

  const handleSyncPEAK = async () => {
    if (!parsedResult) return;
    setPeakSyncing(true);
    try {
      const res = await syncToPEAKAPI({
        contactName: parsedResult.merchantName,
        taxId: parsedResult.taxId,
        issueDate: parsedResult.date,
        description: parsedResult.description,
        category: parsedResult.category,
        subtotal: parsedResult.subtotal || parsedResult.amount,
        vatAmount: parsedResult.vatAmount || 0,
        totalAmount: parsedResult.amount,
        paymentChannel: "Bank Transfer",
        status: "Approved",
      });

      toast.success(`ซิงก์ข้อมูลเข้า PEAK Account สำเร็จ! เลขที่เอกสาร: ${res.peakDocId}`);
    } catch (err) {
      toast.error("ซิงก์ข้อมูลเข้า PEAK ล้มเหลว");
    } finally {
      setPeakSyncing(false);
    }
  };

  const handleExportPEAK = () => {
    if (!parsedResult) return;
    exportToPEAKCSV([
      {
        description: parsedResult.description,
        category: parsedResult.category,
        amount: parsedResult.amount,
        date: parsedResult.date,
        vendor: parsedResult.merchantName,
        taxId: parsedResult.taxId,
        vatAmount: parsedResult.vatAmount,
      },
    ]);
    toast.success("ส่งออกไฟล์ CSV สำหรับ PEAK Account เรียบร้อยแล้ว");
  };

  const handleConfirmAutoKey = () => {
    if (!parsedResult) return;
    if (onApplyTransaction) {
      onApplyTransaction(parsedResult);
    }
    toast.success("บันทึกข้อมูลเข้า Grace Ledger เรียบร้อยแล้ว!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
            AI Smart Multi-Document OCR Scanner
          </DialogTitle>
          <DialogDescription className="text-xs">
            สแกนอ่านใบกำกับภาษี, ใบเสร็จ, สลิปโอนเงิน, บิลเขียนมือ หรือภาพหน้าจอ Shopee/Lazada ด้วย
            AI อัจฉริยะ
          </DialogDescription>
        </DialogHeader>

        {/* Upload Area */}
        {!parsedResult && !scanning && (
          <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 text-center space-y-4 bg-muted/20">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 grid place-items-center text-primary">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่ออัปโหลด</p>
              <p className="text-xs text-muted-foreground mt-1">
                รองรับไฟล์ภาพ JPG, PNG, WEBP หรือ PDF (ใบกำกับภาษี, สลิปโอนเงิน, บิลเขียนมือ,
                ภาพคำสั่งซื้อ)
              </p>
            </div>
            <Input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              id="ai-receipt-upload"
              onChange={handleFileUpload}
            />
            <Button size="sm" onClick={() => document.getElementById("ai-receipt-upload")?.click()}>
              <FileText className="mr-2 h-4 w-4" /> เลือกไฟล์เอกสาร
            </Button>
          </div>
        )}

        {/* Scanning Animation State */}
        {scanning && (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 grid place-items-center text-warning animate-spin">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">AI กำลังอ่านและวิเคราะห์เอกสาร...</p>
              <p className="text-xs text-muted-foreground mt-1">
                ตรวจสอบประเภทเอกสาร, อ่านข้อความ, คำนวณ VAT 7% และตรวจสอบเลขประจำตัวผู้เสียภาษี
              </p>
            </div>
          </div>
        )}

        {/* Parsed Result Display */}
        {parsedResult && (
          <div className="space-y-5">
            {/* Header Result Badge */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                  {parsedResult.docTypeName}
                </Badge>
                {parsedResult.platform && parsedResult.platform !== "General" && (
                  <Badge variant="secondary" className="text-xs">
                    {parsedResult.platform}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                ความแม่นยำ AI: {(parsedResult.confidence * 100).toFixed(0)}%
              </span>
            </div>

            {/* Form Fields Auto-Keyed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-xs font-medium">ชื่อผู้ขาย/ร้านค้า</Label>
                <Input value={parsedResult.merchantName} readOnly className="mt-1 text-xs" />
              </div>

              <div>
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span>เลขประจำตัวผู้เสียภาษี (Tax ID)</span>
                  {parsedResult.taxId && (
                    <span className="flex items-center gap-1 text-[10px]">
                      {parsedResult.isTaxIdValid ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" /> ถูกต้องตามกรมสรรพากร
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                          <AlertCircle className="h-3 w-3" /> เลขไม่ถูกต้อง
                        </span>
                      )}
                    </span>
                  )}
                </Label>
                <Input
                  value={parsedResult.taxId || "ไม่มีข้อมูล Tax ID"}
                  readOnly
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">ยอดเงินรวมสุทธิ</Label>
                <Input
                  value={thb(parsedResult.amount)}
                  readOnly
                  className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">หมวดหมู่ค่าใช้จ่าย (Auto-Categorized)</Label>
                <Input value={parsedResult.category} readOnly className="mt-1 text-xs" />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-medium">รายละเอียดรายการ</Label>
                <Input value={parsedResult.description} readOnly className="mt-1 text-xs" />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncPEAK}
                  disabled={peakSyncing}
                  className="text-xs"
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  {peakSyncing ? "กำลังซิงก์..." : "ซิงก์เข้า PEAK Account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportPEAK}
                  className="text-xs"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  CSV สำหรับ PEAK
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setParsedResult(null)}
                  className="text-xs"
                >
                  สแกนไฟล์ใหม่
                </Button>
                <Button type="button" size="sm" onClick={handleConfirmAutoKey} className="text-xs">
                  <FileCheck className="mr-1.5 h-3.5 w-3.5" />
                  บันทึก Auto-Key เข้า Grace Ledger
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
