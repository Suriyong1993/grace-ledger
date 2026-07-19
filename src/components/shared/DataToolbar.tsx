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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="relative min-w-0 max-w-md w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 rounded-2xl h-11"
        />
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}