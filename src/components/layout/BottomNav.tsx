import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, MOBILE_NAV, NAV_GROUPS, NAV_SYSTEM, useCurrentPath } from "./AppNav";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const path = useCurrentPath();
  const isActive = (to: string) => path === to || path.startsWith(to + "/");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid h-14 grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 text-[10px]",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 bg-primary" />}
              <item.icon className={cn("h-5 w-5", active && "text-primary")} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Sheet>
          <SheetTrigger className="relative flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
            <span>เพิ่มเติม</span>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>เมนูทั้งหมด</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 pb-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="kicker mb-2 px-1 text-[10px]">{group.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-colors",
                          isActive(item.to)
                            ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                            : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        <item.icon
                          className={cn("h-5 w-5", isActive(item.to) && "text-primary")}
                          strokeWidth={1.5}
                        />
                        <span className="text-center leading-tight">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="kicker mb-2 px-1 text-[10px]">ระบบ</p>
                <div className="grid grid-cols-3 gap-2">
                  {NAV_SYSTEM.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-colors",
                        isActive(item.to)
                          ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      <item.icon
                        className={cn("h-5 w-5", isActive(item.to) && "text-primary")}
                        strokeWidth={1.5}
                      />
                      <span className="text-center leading-tight">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
