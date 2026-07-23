import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "โปรไฟล์" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div>
      <PageHeader title="โปรไฟล์" description="จัดการบัญชีของคุณ" />
      <Card className="rounded-3xl max-w-md">
        <CardContent className="p-6 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarFallback
              style={{ background: user.avatarColor ?? "#F97316" }}
              className="text-white text-3xl"
            >
              {user.name[0]}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">{user.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> {ROLE_LABEL[user.role]}
          </p>
          <Button
            variant="outline"
            className="rounded-2xl mt-6"
            onClick={() => {
              logout();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> ออกจากระบบ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
