import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";

export function DataToolbar({
  query,
  onQueryChange,
  placeholder = "ค้นหา...",
  right,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  placeholder?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
      <div className="relative w-full min-w-0 max-w-md">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 bg-card pl-9"
        />
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
