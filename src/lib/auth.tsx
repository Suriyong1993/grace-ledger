import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadDb, logAudit, updateDb } from "@/lib/mock-db";
import type { Role, User } from "@/lib/types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (pin: string) => Promise<User | null>;
  logout: () => void;
  can: (perm: Permission) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export type Permission =
  | "income.write"
  | "income.approve"
  | "expense.write"
  | "expense.approve"
  | "offering.write"
  | "fund.write"
  | "budget.write"
  | "project.write"
  | "member.write"
  | "settings.write"
  | "audit.view";

const MATRIX: Record<Role, Permission[]> = {
  super_admin: [
    "income.write",
    "income.approve",
    "expense.write",
    "expense.approve",
    "offering.write",
    "fund.write",
    "budget.write",
    "project.write",
    "member.write",
    "settings.write",
    "audit.view",
  ],
  pastor: ["income.approve", "expense.approve", "audit.view"],
  treasurer: [
    "income.write",
    "expense.write",
    "offering.write",
    "fund.write",
    "budget.write",
    "project.write",
    "member.write",
  ],
  finance_staff: ["income.write", "expense.write", "offering.write", "member.write"],
  auditor: ["audit.view"],
  viewer: [],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = loadDb();
    if (db.session.userId) {
      const u = db.users.find((x) => x.id === db.session.userId) ?? null;
      setUser(u);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (pin: string) => {
    const db = loadDb();
    const u = db.users.find((x) => x.pin === pin) ?? null;
    if (u) {
      updateDb((d) => {
        d.session.userId = u.id;
      });
      setUser(u);
      logAudit({
        userId: u.id,
        userName: u.name,
        action: "login",
        entity: "auth",
        details: "เข้าสู่ระบบด้วย PIN",
      });
    }
    return u;
  }, []);

  const logout = useCallback(() => {
    if (user) logAudit({ userId: user.id, userName: user.name, action: "logout", entity: "auth" });
    updateDb((d) => {
      d.session.userId = null;
    });
    setUser(null);
  }, [user]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      login,
      logout,
      can: (perm) => (user ? MATRIX[user.role].includes(perm) : false),
      hasRole: (...roles) => (user ? roles.includes(user.role) : false),
    }),
    [user, loading, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
