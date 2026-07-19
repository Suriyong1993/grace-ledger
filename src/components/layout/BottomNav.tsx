import { MoreHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, MOBILE_NAV, NAV, useCurrentPath } from "./AppNav";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const path = useCurrentPath();
  const isActive = (to: string) => path === to || path.startsWith(to + "/");
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-16">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
              isActive(item.to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
        <Sheet>
          <SheetTrigger className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            <span>เพิ่มเติม</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>เมนูทั้งหมด</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium",
                    isActive(item.to) ? "border-primary bg-primary/10 text-primary" : "bg-card text-foreground",
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}