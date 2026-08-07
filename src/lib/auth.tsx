// src/lib/auth.tsx — PIN-based authentication with Supabase Auth
// Users select their name, enter a 6-digit PIN on a number pad.
// The PIN is used as the Supabase Auth password.
// Session is managed by Supabase (httpOnly cookies).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/services/supabaseClient";
import type { Role, User } from "@/lib/types";

/** sessionStorage key for the path a user was on before being redirected to /auth */
export const REDIRECT_STORAGE_KEY = "grace-ledger:auth-redirect";

export type Permission =
  | "income.write"
  | "income.approve"
  | "expense.write"
  | "expense.approve"
  | "offering.write"
  | "offering.approve"
  | "fund.write"
  | "budget.write"
  | "project.write"
  | "member.write"
  | "settings.write"
  | "audit.view";

// Simplified: only super_admin and admin
// super_admin: full access including settings
// admin: everything except settings.write
const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  super_admin: [
    "income.write",
    "income.approve",
    "expense.write",
    "expense.approve",
    "offering.write",
    "offering.approve",
    "fund.write",
    "budget.write",
    "project.write",
    "member.write",
    "settings.write",
    "audit.view",
  ],
  admin: [
    "income.write",
    "income.approve",
    "expense.write",
    "expense.approve",
    "offering.write",
    "offering.approve",
    "fund.write",
    "budget.write",
    "project.write",
    "member.write",
    "audit.view",
  ],
};

// User info for the login screen (fetched from public view)
export interface LoginUser {
  id: string;
  name: string;
  role: Role;
  email: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pin: string) => Promise<User | null>;
  signUp: (
    email: string,
    password: string,
    name: string,
    churchId: string,
    role?: Role,
  ) => Promise<User | null>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  can: (perm: Permission) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

// Fetch the list of active users for the login screen
export async function fetchLoginUsers(): Promise<LoginUser[]> {
  const { data, error } = await supabase
    .from("user_login_list")
    .select("id, name, role, email")
    .order("name");

  if (error || !data) return [];
  return data as LoginUser[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch church user data when auth user changes
  const fetchUserRecord = useCallback(async (authUserId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .single();

    if (error || !data) {
      setUser(null);
    } else {
      setUser(data as User);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Wait for the church-user record before flipping loading off — otherwise
        // there's a window where loading=false and user=null even though the
        // session is valid, which the route guard reads as "logged out".
        await fetchUserRecord(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserRecord(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRecord]);

  // PIN-based sign in: email + PIN (used as password) → Supabase Auth
  const signIn = useCallback(
    async (email: string, pin: string): Promise<User | null> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: pin,
      });

      if (error) throw error;
      if (!data.user) return null;

      await fetchUserRecord(data.user.id);

      const { data: updatedUser } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", data.user.id)
        .single();

      return (updatedUser as User) ?? null;
    },
    [fetchUserRecord],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      churchId: string,
      role: Role = "admin",
    ) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: { name, church_id: churchId, role },
        },
      });

      if (error) throw error;
      return data.user ? ({ id: "temp", name, role } as User) : null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }, []);

  // Alias for signOut (used by AppTopbar, ProfilePage)
  const logout = signOut;

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      logout,
      can: (perm) => (user ? (PERMISSION_MATRIX[user.role]?.includes(perm) ?? false) : false),
      hasRole: (...roles) => (user ? roles.includes(user.role) : false),
    }),
    [user, loading, signIn, signUp, signOut, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
