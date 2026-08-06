/**
 * Grace Ledger v2 — OfflineIndicator
 *
 * Detects network connectivity changes and displays a banner
 * when the browser goes offline, preventing data loss confusion.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Initialize with current state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      // Keep banner visible briefly to show reconnection
      setTimeout(() => setShowBanner(false), 2000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Don't render anything if we've never been offline and are online
  if (!isOffline && !showBanner) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 md:bottom-4",
        isOffline ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-sm px-4 py-2 text-xs font-medium",
          isOffline
            ? "bg-destructive text-destructive-foreground"
            : "bg-success text-success-foreground",
        )}
      >
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            isOffline ? "bg-destructive-foreground/80" : "bg-success-foreground/80",
          )}
        />
        {isOffline ? "ไม่มีการเชื่อมต่ออินเทอร์เน็ต" : "เชื่อมต่ออีกครั้ง"}
      </div>
    </div>
  );
}
