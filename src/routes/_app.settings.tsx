import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resetDb } from "@/lib/mock-db";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "ตั้งค่า" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  return (
    <div>
      <PageHeader title="ตั้งค่า" description="ตั้งค่าระบบและข้อมูล" />
      <Card className="rounded-3xl max-w-2xl">
        <CardHeader><CardTitle>ข้อมูลระบบ</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">รีเซ็ตข้อมูลตัวอย่างทั้งหมดกลับสู่ค่าเริ่มต้น</p>
          <Button variant="outline" className="rounded-2xl" onClick={() => { resetDb(); qc.invalidateQueries(); toast.success("รีเซ็ตข้อมูลแล้ว"); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> รีเซ็ตข้อมูลตัวอย่าง
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}