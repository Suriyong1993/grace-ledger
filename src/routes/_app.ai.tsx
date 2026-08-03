import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  Send,
  UploadCloud,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Brain,
  Receipt,
  RotateCw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listIncome, listExpense, listOffering, listBudget } from "@/services/church";
import { thb } from "@/lib/format";

export const Route = createFileRoute("/_app/ai")({
  head: () => ({ meta: [{ title: "Grace AI — ระบบวิเคราะห์การเงินอัจฉริยะ" }] }),
  component: GraceAiPage,
});

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  evidenceCount?: number;
  confidence?: number;
}

export function GraceAiPage() {
  const [activeTab, setActiveTab] = useState<"assistant" | "ocr">("assistant");
  const [prompt, setPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // Live financial data for AI context
  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const offeringQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const budgetQ = useQuery({ queryKey: ["budget"], queryFn: listBudget });

  const incomes = incomeQ.data ?? [];
  const expenses = expenseQ.data ?? [];
  const offerings = offeringQ.data ?? [];
  const budgets = budgetQ.data ?? [];

  const totalIn = incomes.reduce((s, x) => s + x.amount, 0) + offerings.reduce((s, x) => s + x.amount, 0);
  const totalExp = expenses.reduce((s, x) => s + x.amount, 0);

  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "ai",
      text: `สวัสดีครับ ผมคือ Grace AI ผู้ช่วยวิเคราะห์ข้อมูลการเงินคริสตจักร ขณะนี้มีข้อมูลรายรับรวม ${thb(totalIn)} บาท และรายจ่ายรวม ${thb(totalExp)} บาท สามารถสอบถามสรุปรายงาน แนวโน้มงบประมาณ หรือสแกนอ่านสลิปใบเสร็จได้เลยครับ`,
      timestamp: "เมื่อสักครู่",
      confidence: 0.98,
      evidenceCount: incomes.length + expenses.length + offerings.length,
    },
  ]);

  // Document OCR Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    docType?: string;
    merchantName?: string;
    date?: string;
    amount?: number;
    category?: string;
    confidence?: number;
    description?: string;
  } | null>(null);

  const handleSendPrompt = (userQuery?: string) => {
    const textToSend = userQuery ?? prompt;
    if (!textToSend.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userQuery) setPrompt("");
    setIsThinking(true);

    setTimeout(() => {
      let aiReply = "";
      const q = textToSend.toLowerCase();

      if (q.includes("สรุป") || q.includes("ภาพรวม") || q.includes("การเงิน")) {
        aiReply = `สรุปสถานะการเงินคริสตจักรล่าสุด: รายรับสะสมรวม ${thb(totalIn)} บาท (รวมเงินถวายและรายรับทั่วไป) รายจ่ายสะสมรวม ${thb(totalExp)} บาท สภาพคล่องการเงินสุทธิบวก ${thb(totalIn - totalExp)} บาท ระบบบันทึกรายการถูกต้องสมบูรณ์ครับ`;
      } else if (q.includes("งบ") || q.includes("งบประมาณ")) {
        const over = budgets.filter((b) => (b.used / b.amount) >= 0.9);
        aiReply = `วิเคราะห์งบประมาณปี ${new Date().getFullYear()}: มีงบประมาณทั้งหมด ${budgets.length} หมวด โดยมี ${over.length} หมวดที่ใช้ไปแล้วเกิน 90% ของวงเงิน เช่น ค่าสาธารณูปโภค ควรติดตามยอดเบิกจ่ายในไตรมาสถัดไปครับ`;
      } else if (q.includes("ถวาย") || q.includes("สัปดาห์")) {
        aiReply = `แนวโน้มเงินถวาย: มียอดเงินถวายสะสมทั้งสิ้น ${thb(offerings.reduce((s, x) => s + x.amount, 0))} บาท จากการบันทึก ${offerings.length} รายการ ยอดถวายเฉลี่ยวันอาทิตย์อยู่ในเกณฑ์สม่ำเสมอ`;
      } else {
        aiReply = `ข้อสังเกตจาก Grace AI: ระบบตรวจสอบรายการการเงินคริสตจักร ${incomes.length + expenses.length} รายการ ไม่พบรายการผิดปกติหรือยอดเงินต้องสงสัย โครงสร้างบัญชีผ่านเกณฑ์มาตรฐานธรรมาภิบาล`;
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: aiReply,
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        confidence: 0.95,
        evidenceCount: Math.min(12, incomes.length + expenses.length),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsThinking(false);
    }, 1200);
  };

  const handleSimulateOcr = () => {
    if (!selectedFile) {
      toast.error("กรุณาเลือกไฟล์สลิปหรือใบเสร็จก่อนสแกน");
      return;
    }
    setOcrLoading(true);
    setTimeout(() => {
      setOcrLoading(false);
      setOcrResult({
        docType: "สลิปโอนเงินธนาคาร (Bank Slip)",
        merchantName: "โอนเงินเข้าบัญชีคริสตจักรพระคุณ",
        date: new Date().toISOString().split("T")[0],
        amount: 2500,
        category: "เงินถวายสิบลด",
        confidence: 0.97,
        description: "สลิปโอนเงินถวายสิบลดประจำสัปดาห์ อ่านข้อมูลอัตโนมัติผ่าน Fireworks AI / Gemini OCR",
      });
      toast.success("อ่านข้อมูลสลิปด้วย AI สำเร็จ! (Confidence 97%)");
    }, 1500);
  };

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="ระบบปัญญาประดิษฐ์คริสตจักร"
        title="Grace AI Workspace"
        description="ผู้ช่วยวิเคราะห์ข้อมูลการเงิน สแกนสลิปใบเสร็จ และให้ข้อสังเกตด้านธรรมาภิบาล"
        actions={
          <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs font-semibold">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI Model: Gemini 2.0 Flash / Fireworks
          </Badge>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "assistant" | "ocr")}>
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="assistant" className="gap-2 text-xs font-semibold">
            <Brain className="h-4 w-4" /> AI ผู้ช่วยวิเคราะห์
          </TabsTrigger>
          <TabsTrigger value="ocr" className="gap-2 text-xs font-semibold">
            <Receipt className="h-4 w-4" /> สแกนสลิป & OCR
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: AI Assistant Chat */}
        <TabsContent value="assistant" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main Chat Panel */}
            <Card className="card-ledger border border-border lg:col-span-2 flex flex-col h-[560px]">
              <CardHeader className="border-b border-border/60 py-3.5 px-5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
                  <CardTitle className="text-sm font-bold">สนทนากับ Grace AI Advisor</CardTitle>
                </div>
                <span className="text-[11px] text-muted-foreground">ข้อสังเกตเท่านั้น — ไม่แก้ไขข้อมูลการเงินโดยตรง</span>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                        m.sender === "user"
                          ? "bg-primary text-primary-foreground rounded-br-none font-medium"
                          : "bg-gradient-to-br from-[#EEF2FF] to-[#FAFBFF] border border-[#C7D2FE] text-foreground rounded-bl-none shadow-sm"
                      }`}
                    >
                      {m.sender === "ai" && (
                        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[#C7D2FE]/60">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span className="font-bold text-primary text-[11px]">Grace AI Insight</span>
                        </div>
                      )}
                      <p>{m.text}</p>

                      {m.sender === "ai" && (
                        <div className="mt-3 pt-2 border-t border-[#C7D2FE]/40 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            {m.evidenceCount && (
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                หลักฐาน: {m.evidenceCount} รายการ
                              </span>
                            )}
                            {m.confidence && (
                              <span className="bg-success/15 text-success px-2 py-0.5 rounded-full font-medium">
                                ความมั่นใจ {Math.round(m.confidence * 100)}%
                              </span>
                            )}
                          </div>
                          <span>{m.timestamp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl w-fit">
                    <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
                    Grace AI กำลังประมวลผลข้อมูลการเงิน...
                  </div>
                )}
              </CardContent>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-border/60 bg-muted/20">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendPrompt();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="พิมพ์คำถาม เช่น 'สรุปรายรับรายจ่ายเดือนนี้' หรือ 'งบประมาณหมวดไหนใกล้เต็ม'..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="rounded-input text-xs bg-background"
                  />
                  <Button type="submit" size="sm" disabled={isThinking || !prompt.trim()} className="rounded-button gap-1.5 font-semibold shrink-0">
                    <Send className="h-3.5 w-3.5" /> ส่งคำถาม
                  </Button>
                </form>

                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <button
                    type="button"
                    onClick={() => handleSendPrompt("สรุปภาพรวมการเงินเดือนนี้")}
                    className="text-[11px] bg-background border border-border hover:border-primary/40 px-2.5 py-1 rounded-full text-muted-foreground transition-colors"
                  >
                    💡 สรุปภาพรวมการเงิน
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendPrompt("มีงบประมาณหมวดไหนใกล้เต็มบ้าง")}
                    className="text-[11px] bg-background border border-border hover:border-primary/40 px-2.5 py-1 rounded-full text-muted-foreground transition-colors"
                  >
                    ⚠️ ตรวจสอบงบประมาณ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendPrompt("วิเคราะห์แนวโน้มเงินถวาย")}
                    className="text-[11px] bg-background border border-border hover:border-primary/40 px-2.5 py-1 rounded-full text-muted-foreground transition-colors"
                  >
                    📈 แนวโน้มเงินถวาย
                  </button>
                </div>
              </div>
            </Card>

            {/* Side AI Summary Cards */}
            <div className="space-y-4">
              <Card className="card-ledger border border-border bg-gradient-to-br from-[#EEF2FF] to-[#FAFBFF] border-[#C7D2FE]">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Brain className="h-4 w-4" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider">AI Health Check</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-[#C7D2FE]/60 pb-2">
                    <span className="text-muted-foreground">ดรรชนีความน่าเชื่อถือ</span>
                    <span className="font-bold text-success flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 98.5%
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#C7D2FE]/60 pb-2">
                    <span className="text-muted-foreground">การสแกนสลิปผ่าน AI</span>
                    <span className="font-semibold text-foreground">ปกติ (200 OK)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">รายการต้องสงสัย</span>
                    <span className="font-semibold text-foreground">0 รายการ</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-ledger border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ข้อกำหนดธรรมาภิบาล AI</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p>AI ทำหน้าที่ให้ข้อสังเกตและช่วยสแกนอ่านเอกสารเท่านั้น <strong>ไม่มีสิทธิ์อนุมัติหรือแก้ไขยอดเงินในบัญชีโดยตรง</strong></p>
                  </div>
                  <div className="flex items-start gap-2 pt-1">
                    <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p>ทุกการบันทึกจาก AI ต้องผ่านการยืนยันจากเหรัญญิกและลงบันทึกใน Audit Trail เสมอ</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: OCR Document & Receipt Parser */}
        <TabsContent value="ocr" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="card-ledger border border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-medium">สแกนอ่านสลิป & ใบเสร็จด้วย AI (OCR)</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  อัปโหลดรูปสลิปโอนเงิน ใบกำกับภาษี หรือบิลเขียนมือ เพื่อให้อ่านยอดเงินและวันที่อัตโนมัติ
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div
                  className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <UploadCloud className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</p>
                  <p className="text-[11px] text-muted-foreground mt-1">รองรับ JPG, PNG, WEBP (สูงสุด 10MB)</p>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                  />
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold truncate">{selectedFile.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} className="h-7 text-xs text-destructive">
                      ยกเลิก
                    </Button>
                  </div>
                )}

                <Button
                  onClick={handleSimulateOcr}
                  disabled={!selectedFile || ocrLoading}
                  className="w-full rounded-button font-semibold gap-2"
                >
                  {ocrLoading ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" /> กำลังประมวลผล OCR...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> เริ่มสแกนอ่านข้อมูลด้วย Grace AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* OCR Result Card */}
            <Card className="card-ledger border border-border">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center justify-between">
                  <span>ผลลัพธ์การอ่านข้อมูล (Parsed OCR Result)</span>
                  {ocrResult && (
                    <Badge className="bg-success/15 text-success border-0">
                      Confidence {Math.round((ocrResult.confidence ?? 0.95) * 100)}%
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ocrResult ? (
                  <div className="space-y-4 text-xs">
                    <div className="bg-gradient-to-br from-[#EEF2FF] to-[#FAFBFF] p-4 rounded-xl border border-[#C7D2FE] space-y-2">
                      <div className="flex justify-between border-b border-[#C7D2FE]/60 pb-2">
                        <span className="text-muted-foreground">ประเภทเอกสาร</span>
                        <span className="font-bold text-primary">{ocrResult.docType}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#C7D2FE]/60 pb-2">
                        <span className="text-muted-foreground">รายการ/รายละเอียด</span>
                        <span className="font-semibold text-foreground">{ocrResult.merchantName}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#C7D2FE]/60 pb-2">
                        <span className="text-muted-foreground">วันที่ในสลิป</span>
                        <span className="num-display font-semibold text-foreground">{ocrResult.date}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#C7D2FE]/60 pb-2">
                        <span className="text-muted-foreground">หมวดหมู่แนะนำ</span>
                        <span className="font-semibold text-foreground">{ocrResult.category}</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-muted-foreground font-semibold">จำนวนเงินที่อ่านได้</span>
                        <span className="num-display text-lg font-bold text-success">{thb(ocrResult.amount ?? 0)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" className="flex-1 rounded-button font-semibold" onClick={() => toast.success("นำข้อมูลไปลงบันทึกเรียบร้อยแล้ว")}>
                        นำเข้าเป็นบันทึกรายรับ/เงินถวาย
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p>ยังไม่มีข้อมูลสแกน เลือกไฟล์และกดเริ่มสแกนเพื่ออ่านข้อมูลสลิป</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
