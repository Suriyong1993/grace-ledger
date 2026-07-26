import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, MOBILE_NAV, NAV, useCurrentPath } from "./AppNav";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const path = useCurrentPath();
  const isActive = (to: string) => path === to || path.startsWith(to + "/");
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-[10px]",
              isActive(item.to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
        <Sheet>
          <SheetTrigger className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            <span>เพิ่มเติม</span>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>เมนูทั้งหมด</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-2 border p-3 text-xs",
                    isActive(item.to)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
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
