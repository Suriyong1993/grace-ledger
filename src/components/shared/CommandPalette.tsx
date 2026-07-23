import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  HandHeart,
  Wallet,
  PiggyBank,
  Briefcase,
  Users,
  ScrollText,
  LayoutDashboard,
  FileBarChart2,
  Settings,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  listAudit,
  listBudget,
  listExpense,
  listFunds,
  listIncome,
  listMembers,
  listOffering,
  listProjects,
  listCategories,
  listOfferingCategories,
} from "@/services/church";
import { thb, fmtDate } from "@/lib/format";

const RECENT_KEY = "cfm.recentSearch";

function useRecent() {
  const [items, setItems] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const push = (q: string) => {
    if (!q.trim()) return;
    const next = [q, ...items.filter((x) => x !== q)].slice(0, 6);
    setItems(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };
  return { items, push };
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const nav = useNavigate();
  const recent = useRecent();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const inQ = useQuery({ queryKey: ["income"], queryFn: listIncome, enabled: open });
  const exQ = useQuery({ queryKey: ["expense"], queryFn: listExpense, enabled: open });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering, enabled: open });
  const fundQ = useQuery({ queryKey: ["funds"], queryFn: listFunds, enabled: open });
  const budQ = useQuery({ queryKey: ["budget"], queryFn: listBudget, enabled: open });
  const projQ = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled: open });
  const memQ = useQuery({ queryKey: ["members"], queryFn: listMembers, enabled: open });
  const audQ = useQuery({ queryKey: ["audit"], queryFn: listAudit, enabled: open });
  const catQ = useQuery({ queryKey: ["categories"], queryFn: listCategories, enabled: open });
  const offCatQ = useQuery({
    queryKey: ["offering-categories"],
    queryFn: listOfferingCategories,
    enabled: open,
  });

  const s = debounced.trim().toLowerCase();
  const catName = (id: string) => catQ.data?.find((c) => c.id === id)?.name ?? "";
  const fundName = (id: string) => fundQ.data?.find((f) => f.id === id)?.name ?? "";
  const offCatName = (id: string) => offCatQ.data?.find((c) => c.id === id)?.name ?? id;

  const results = useMemo(() => {
    const hit = (str: unknown) =>
      !s ||
      String(str ?? "")
        .toLowerCase()
        .includes(s);
    return {
      income: (inQ.data ?? [])
        .filter(
          (r) =>
            hit(r.description) ||
            hit(catName(r.categoryId)) ||
            hit(fundName(r.fundId)) ||
            hit(r.amount),
        )
        .slice(0, 6),
      expense: (exQ.data ?? [])
        .filter(
          (r) =>
            hit(r.description) ||
            hit(r.vendor) ||
            hit(catName(r.categoryId)) ||
            hit(fundName(r.fundId)) ||
            hit(r.amount),
        )
        .slice(0, 6),
      offering: (offQ.data ?? [])
        .filter((r) => hit(offCatName(r.categoryId)) || hit(fundName(r.fundId)) || hit(r.amount))
        .slice(0, 6),
      funds: (fundQ.data ?? []).filter((r) => hit(r.name) || hit(r.description)).slice(0, 6),
      budgets: (budQ.data ?? []).filter((r) => hit(r.name) || hit(r.department)).slice(0, 6),
      projects: (projQ.data ?? []).filter((r) => hit(r.name) || hit(r.description)).slice(0, 6),
      members: (memQ.data ?? [])
        .filter(
          (r) => hit(r.name) || hit(r.family) || hit(r.department) || hit(r.phone) || hit(r.email),
        )
        .slice(0, 6),
      audit: (audQ.data ?? [])
        .filter((r) => hit(r.userName) || hit(r.action) || hit(r.entity) || hit(r.details))
        .slice(0, 6),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    s,
    inQ.data,
    exQ.data,
    offQ.data,
    fundQ.data,
    budQ.data,
    projQ.data,
    memQ.data,
    audQ.data,
    catQ.data,
    offCatQ.data,
  ]);

  const go = (to: string) => {
    recent.push(q);
    onOpenChange(false);
    nav({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="ค้นหารายรับ, รายจ่าย, สมาชิก, กองทุน, โครงการ..."
      />
      <CommandList>
        <CommandEmpty>ไม่พบผลลัพธ์</CommandEmpty>

        {!s && (
          <>
            <CommandGroup heading="ทางลัด">
              <CommandItem onSelect={() => go("/dashboard")}>
                <LayoutDashboard className="h-4 w-4 mr-2 text-primary" /> แดชบอร์ด
              </CommandItem>
              <CommandItem onSelect={() => go("/income")}>
                <ArrowDownCircle className="h-4 w-4 mr-2 text-success" /> รายรับ
              </CommandItem>
              <CommandItem onSelect={() => go("/expense")}>
                <ArrowUpCircle className="h-4 w-4 mr-2 text-destructive" /> รายจ่าย
              </CommandItem>
              <CommandItem onSelect={() => go("/offering")}>
                <HandHeart className="h-4 w-4 mr-2 text-primary" /> เงินถวาย
              </CommandItem>
              <CommandItem onSelect={() => go("/funds")}>
                <Wallet className="h-4 w-4 mr-2 text-secondary" /> กองทุน
              </CommandItem>
              <CommandItem onSelect={() => go("/reports")}>
                <FileBarChart2 className="h-4 w-4 mr-2" /> รายงาน
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")}>
                <Settings className="h-4 w-4 mr-2" /> ตั้งค่า
              </CommandItem>
            </CommandGroup>
            {recent.items.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="ค้นหาล่าสุด">
                  {recent.items.map((r) => (
                    <CommandItem key={r} onSelect={() => setQ(r)}>
                      {r}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}

        {results.income.length > 0 && (
          <CommandGroup heading="รายรับ">
            {results.income.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/income")}>
                <ArrowDownCircle className="h-4 w-4 mr-2 text-success" />
                <span className="flex-1 truncate">
                  {catName(r.categoryId)} · {r.description || fundName(r.fundId)}
                </span>
                <span className="text-xs text-muted-foreground ml-2">{fmtDate(r.date)}</span>
                <span className="text-success ml-2 tabular-nums">{thb(r.amount)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.expense.length > 0 && (
          <CommandGroup heading="รายจ่าย">
            {results.expense.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/expense")}>
                <ArrowUpCircle className="h-4 w-4 mr-2 text-destructive" />
                <span className="flex-1 truncate">
                  {catName(r.categoryId)} · {r.vendor || r.description}
                </span>
                <span className="text-xs text-muted-foreground ml-2">{fmtDate(r.date)}</span>
                <span className="text-destructive ml-2 tabular-nums">{thb(r.amount)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.offering.length > 0 && (
          <CommandGroup heading="เงินถวาย">
            {results.offering.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/offering")}>
                <HandHeart className="h-4 w-4 mr-2 text-primary" />
                <span className="flex-1 truncate">
                  {offCatName(r.categoryId)} · {fundName(r.fundId)}
                </span>
                <span className="text-xs text-muted-foreground ml-2">{fmtDate(r.date)}</span>
                <span className="text-primary ml-2 tabular-nums">{thb(r.amount)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.funds.length > 0 && (
          <CommandGroup heading="กองทุน">
            {results.funds.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/funds")}>
                <Wallet className="h-4 w-4 mr-2 text-secondary" />
                <span className="flex-1 truncate">{r.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.budgets.length > 0 && (
          <CommandGroup heading="งบประมาณ">
            {results.budgets.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/budget")}>
                <PiggyBank className="h-4 w-4 mr-2" />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                  {thb(r.amount)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.projects.length > 0 && (
          <CommandGroup heading="โครงการ">
            {results.projects.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/projects")}>
                <Briefcase className="h-4 w-4 mr-2" />
                <span className="flex-1 truncate">{r.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.members.length > 0 && (
          <CommandGroup heading="สมาชิก">
            {results.members.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/members")}>
                <Users className="h-4 w-4 mr-2" />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{r.department}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.audit.length > 0 && (
          <CommandGroup heading="Audit Logs">
            {results.audit.map((r) => (
              <CommandItem key={r.id} onSelect={() => go("/audit")}>
                <ScrollText className="h-4 w-4 mr-2" />
                <span className="flex-1 truncate">
                  {r.userName} · {r.action} · {r.entity}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
