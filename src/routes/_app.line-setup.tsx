import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle,
  QrCode,
  Key,
  Copy,
  Send,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { listLineUsers, listMembers, listOffering } from "@/services/church";
import { thb, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_app/line-setup")({
  head: () => ({ meta: [{ title: "ตั้งค่า LINE OA — Grace Ledger" }] }),
  component: LineSetupPage,
});

function LineSetupPage() {
  // LINE credentials are managed server-side via environment variables.
  // These fields are for display/configuration only — never commit real secrets.
  const [channelId, setChannelId] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [webhookUrl] = useState(
    () =>
      `${import.meta.env.VITE_SUPABASE_URL ?? "https://your-project.supabase.co"}/functions/v1/line-webhook`,
  );
  const [isTesting, setIsTesting] = useState(false);

  // Queries for live database metrics
  const lineUsersQ = useQuery({ queryKey: ["line-users"], queryFn: listLineUsers });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const offeringQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });

  const lineUsers = lineUsersQ.data ?? [];
  const members = membersQ.data ?? [];
  const offerings = offeringQ.data ?? [];

  // Real latest-Sunday total — used only to preview the message *format*,
  // not to claim anything was actually sent (no LINE connection exists yet).
  const latestOfferingDate = offerings.reduce(
    (latest, o) => (!latest || o.date > latest ? o.date : latest),
    "",
  );
  const latestOfferings = offerings.filter((o) => o.date === latestOfferingDate);
  const latestOfferingTotal = latestOfferings.reduce((s, o) => s + o.amount, 0);

  // LINE Bot features toggle state
  const [enableNotify, setEnableNotify] = useState(true);
  const [enableSlipOCR, setEnableSlipOCR] = useState(true);
  const [enableWeeklyOffering, setEnableWeeklyOffering] = useState(true);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("คัดลอก Webhook URL เรียบร้อยแล้ว");
  };

  // Real LINE channel credentials are configured server-side via environment
  // variables, not through this form (see comment above) — there is no API
  // endpoint that persists these fields, and no real webhook to test from the
  // browser. Both handlers below say so honestly instead of faking success.
  const handleTestConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      toast.error("ฟีเจอร์ทดสอบการเชื่อมต่อยังไม่พร้อมใช้งาน — ยังไม่เชื่อมต่อ LINE จริง");
    }, 600);
  };

  const handleSaveSettings = () => {
    toast.error(
      "หน้านี้ยังไม่บันทึกข้อมูลจริง — Channel credentials ตั้งค่าผ่าน environment variable ฝั่งเซิร์ฟเวอร์เท่านั้น",
    );
  };

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="ระบบการแจ้งเตือน"
        title="ตั้งค่า LINE Official Account"
        description="เชื่อมต่อระบบการเงินคริสตจักรกับ LINE Messaging API"
        actions={
          <div className="flex items-center gap-2">
            <Badge className="border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              <AlertCircle className="mr-1.5 h-3.5 w-3.5" /> ทดลอง — ยังไม่เชื่อมต่อจริง
            </Badge>
            <Button size="sm" variant="outline" onClick={handleSaveSettings}>
              บันทึกการตั้งค่า
            </Button>
          </div>
        }
      />
      <div className="-mt-4 mb-2 flex items-start gap-2 rounded-card border border-warning/30 bg-warning/5 px-4 py-2.5 text-xs text-warning">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          หน้านี้เป็นตัวอย่างสาธิต (demo) — ช่อง Channel ID/Secret/Access Token
          ด้านล่างไม่ได้ถูกบันทึก จริง (credentials จริงตั้งค่าผ่าน environment variable
          ฝั่งเซิร์ฟเวอร์เท่านั้น) และปุ่มทดสอบ การเชื่อมต่อ/บันทึกยังไม่มีผลจริง
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Status Card */}
        <Card className="card-ledger border border-border lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">สถานะการเชื่อมต่อ</CardTitle>
            </div>
            <CardDescription className="text-xs">
              เชื่อมต่อ LINE Official Account ของคริสตจักร
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-medium text-muted-foreground">สถานะบอท</span>
              <Badge className="bg-muted text-muted-foreground border-0">ยังไม่เชื่อมต่อ</Badge>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-medium text-muted-foreground">Webhook Status</span>
              <span className="text-xs font-semibold text-muted-foreground">ยังไม่ทดสอบ</span>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-medium text-muted-foreground">
                สมาชิกที่ผูกบัญชี LINE
              </span>
              <span className="num-display text-xs font-semibold text-foreground">
                {lineUsers.length} คน{" "}
                {members.length > 0 ? `(จากสมาชิกทั้งหมด ${members.length} คน)` : ""}
              </span>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3.5 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <QrCode className="h-4 w-4 text-primary" /> LINE Official QR Code
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                สมาชิกสามารถสแกน QR Code เพื่อผูกบัญชีผู้ถวายและรับใบเสร็จผ่าน LINE
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full text-xs">
                ดาวน์โหลด QR Code สำหรับคริสตจักร
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Credentials Card */}
        <Card className="card-ledger border border-border lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-medium">
                LINE Developers API Credentials
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              ตัวอย่างฟอร์ม — credentials จริงตั้งค่าผ่าน environment variable ฝั่งเซิร์ฟเวอร์
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook URL</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs bg-muted/20" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhook}
                  title="คัดลอก Webhook URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                คัดลอก URL นี้ไปใส่ในช่อง Webhook URL ใน LINE Developers Console
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Channel ID</Label>
                <Input
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Channel Secret</Label>
                <Input
                  type="password"
                  value={channelSecret}
                  onChange={(e) => setChannelSecret(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Channel Access Token (Long-Lived)</Label>
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />{" "}
                ฟอร์มนี้ไม่ส่งหรือบันทึกค่าที่กรอกไปที่ใด
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> กำลังทดสอบ...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-3.5 w-3.5" /> ทดสอบการเชื่อมต่อ
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Automated Features Card */}
        <Card className="card-ledger border border-border lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-medium">
                ฟีเจอร์การแจ้งเตือนอัตโนมัติผ่าน LINE
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              เลือกเปิด-ปิดฟีเจอร์โต้ตอบอัตโนมัติของบอทคริสตจักร (ตัวอย่าง —
              การเปลี่ยนค่าด้านล่างยังไม่ถูกบันทึก)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  แจ้งเตือนสลิปถวาย / รายรับเข้า
                </p>
                <p className="text-xs text-muted-foreground">
                  ส่งข้อความยืนยันเมื่อมีสลิปเงินถวายหรือรายรับถูกบันทึกเข้าระบบ
                </p>
              </div>
              <Switch checked={enableNotify} onCheckedChange={setEnableNotify} />
            </div>

            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  ระบบอ่านสลิปอัตโนมัติ (Slip OCR Reader)
                </p>
                <p className="text-xs text-muted-foreground">
                  ให้สมาชิกส่งรูปสลิปใน LINE แล้วบอทจะอ่านยอดเงิน วันที่ และผู้โอนอัตโนมัติ
                </p>
              </div>
              <Switch checked={enableSlipOCR} onCheckedChange={setEnableSlipOCR} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">รายงานสรุปยอดถวายประจำสัปดาห์</p>
                <p className="text-xs text-muted-foreground">
                  ส่งรายงานสรุปยอดถวายวันอาทิตย์ให้ผู้ดูแลระบบและคณะเหรัญญิกทาง LINE Group
                </p>
              </div>
              <Switch checked={enableWeeklyOffering} onCheckedChange={setEnableWeeklyOffering} />
            </div>
          </CardContent>
        </Card>

        {/* Message Preview Card — format preview only, built from real latest-Sunday data */}
        {enableWeeklyOffering && (
          <Card className="card-ledger border border-border lg:col-span-1">
            <CardHeader>
              <CardTitle className="kicker text-muted-foreground">
                ตัวอย่างข้อความที่จะส่ง
              </CardTitle>
              <CardDescription className="text-[11px]">
                รูปแบบข้อความเมื่อเชื่อมต่อ LINE จริงแล้ว — ยังไม่ได้ส่งจริง
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-muted/50 p-3.5 text-xs leading-relaxed">
                <p className="font-bold text-foreground">🔔 Grace Ledger — สรุปเงินถวาย</p>
                {latestOfferingDate ? (
                  <>
                    <p className="mt-1.5 text-foreground">
                      เงินถวาย {fmtDate(latestOfferingDate)}:{" "}
                      <span className="num-display font-semibold">{thb(latestOfferingTotal)}</span>
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      จาก {latestOfferings.length} รายการที่บันทึกไว้
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-muted-foreground">
                    ยังไม่มีข้อมูลเงินถวายให้แสดงตัวอย่าง
                  </p>
                )}
              </div>
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                ส่งอัตโนมัติหลังปิดรอบนับ · ไม่มีปุ่มอนุมัติในข้อความ (นโยบายความปลอดภัย)
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
