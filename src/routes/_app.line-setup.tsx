import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MessageCircle, Link2, Unlink, CheckCircle2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLineUserStatus, linkLineUser, unlinkLineUser } from "@/services/church";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/line-setup")({
  head: () => ({ meta: [{ title: "LINE — เชื่อมต่อ" }] }),
  component: LineSetup,
});

function LineSetup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lineId, setLineId] = useState("");

  const statusQ = useQuery({
    queryKey: ["line-status"],
    queryFn: getLineUserStatus,
  });

  const linkMut = useMutation({
    mutationFn: (id: string) => linkLineUser(id, user!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["line-status"] });
      toast.success("เชื่อมต่อ LINE สำเร็จ");
      setLineId("");
    },
    onError: (e) => toast.error(`เชื่อมต่อไม่สำเร็จ: ${(e as Error).message}`),
  });

  const unlinkMut = useMutation({
    mutationFn: () => unlinkLineUser(user!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["line-status"] });
      toast.success("ยกเลิกการเชื่อมต่อแล้ว");
    },
    onError: (e) => toast.error(`ยกเลิกไม่สำเร็จ: ${(e as Error).message}`),
  });

  const linked = statusQ.data?.linked ?? false;

  return (
    <div className="space-y-6">
      <PageHeader title="LINE" description="เชื่อมต่อบัญชี LINE เพื่อบันทึกธุรกรรมผ่านแชท" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">สถานะการเชื่อมต่อ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center bg-[#06C755]/10 text-[#06C755]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">LINE Messaging</p>
                <p className="text-xs text-muted-foreground">
                  {linked ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
                </p>
              </div>
              <Badge variant={linked ? "default" : "secondary"} className="ml-auto">
                {linked ? "เชื่อมต่อ" : "ไม่ได้เชื่อมต่อ"}
              </Badge>
            </div>

            {linked && statusQ.data?.lineUserId && (
              <div className="border border-border p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">LINE User ID: </span>
                {statusQ.data.lineUserId}
              </div>
            )}

            {linked ? (
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => unlinkMut.mutate()}
                disabled={unlinkMut.isPending}
              >
                <Unlink className="h-4 w-4 mr-2" />
                {unlinkMut.isPending ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อมต่อ"}
              </Button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  placeholder="กรอก LINE User ID"
                  className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
                <Button
                  className="w-full"
                  onClick={() => linkMut.mutate(lineId)}
                  disabled={!lineId.trim() || linkMut.isPending}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {linkMut.isPending ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">วิธีใช้งาน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <Step num={1} title="เพิ่มเพื่อน LINE Bot">
                สแกน QR Code หรือค้นหา @grace-ledger ใน LINE
              </Step>
              <Step num={2} title="เชื่อมต่อบัญชี">
                กรอก LINE User ID ที่ได้จากการเพิ่มเพื่อน
              </Step>
              <Step num={3} title="ส่งข้อความบันทึก">
                พิมพ์ "ค่าน้ำมัน 850" หรือส่งรูปใบเสร็จ
              </Step>
              <Step num={4} title="AI บันทึกอัตโนมัติ">
                ระบบจะแยกประเภทและบันทึกให้อัตโนมัติ
              </Step>
            </div>

            <div className="border border-border p-4 text-center">
              <QrCode className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">
                QR Code จะแสดงเมื่อตั้งค่า LINE Channel แล้ว
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Example messages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">ตัวอย่างข้อความที่รองรับ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { msg: "ค่าน้ำมัน 850", desc: "รายจ่าย → เดินทาง" },
              { msg: "ค่าข้าว 120", desc: "รายจ่าย → อาหาร" },
              { msg: "รับเงินจากลูกค้า 3500", desc: "รายรับ" },
              { msg: "ค่าไฟ 2300", desc: "รายจ่าย → สาธารณูปโภค" },
              { msg: "บริจาค 500", desc: "รายจ่าย → บริจาค" },
              { msg: "[ส่งรูปใบเสร็จ]", desc: "AI อ่านจากภาพ" },
            ].map((ex, i) => (
              <div key={i} className="border border-border p-3">
                <p className="text-sm font-medium">{ex.msg}</p>
                <p className="text-xs text-muted-foreground mt-1">{ex.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-6 w-6 shrink-0 place-items-center bg-primary text-primary-foreground text-xs font-bold">
        {num}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
