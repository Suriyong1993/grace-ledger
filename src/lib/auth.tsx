// src/lib/auth.tsx — Updated for Supabase Auth
// Changes from mock version:
// 1. Uses Supabase Auth (email/password) instead of PIN 6 digits
// 2. Session stored in Supabase httpOnly cookies (not localStorage)
// 3. Auth state managed by Supabase Auth listener
// 4. RLS enforces data access at DB level

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/services/supabaseClient';
import type { Role, User } from '@/lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (email: string, password: string, name: string, churchId: string, role?: Role) => Promise<User | null>;
  signOut: () => Promise<void>;
  can: (perm: Permission) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export type Permission =
  | 'income.write'
  | 'income.approve'
  | 'expense.write'
  | 'expense.approve'
  | 'offering.write'
  | 'fund.write'
  | 'budget.write'
  | 'project.write'
  | 'member.write'
  | 'settings.write'
  | 'audit.view';

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  super_admin: [
    'income.write', 'income.approve',
    'expense.write', 'expense.approve',
    'offering.write', 'offering.approve',
    'fund.write', 'budget.write', 'project.write',
    'member.write', 'settings.write', 'audit.view',
  ],
  pastor: ['income.approve', 'expense.approve', 'audit.view'],
  treasurer: [
    'income.write', 'expense.write', 'offering.write',
    'fund.write', 'budget.write', 'project.write', 'member.write',
  ],
  finance_staff: ['income.write', 'expense.write', 'offering.write', 'member.write'],
  auditor: ['audit.view'],
  viewer: [],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch church user data when auth user changes
  const fetchUserRecord = useCallback(async (authUserId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error || !data) {
      setUser(null);
    } else {
      setUser(data as User);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserRecord(session.user.id);
      }
      setLoading(false);
    });

    // Listen for future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchUserRecord(session.user.id);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserRecord]);

  // FIX: Don't depend on `user` in signIn's return type — return the freshly fetched User instead
  const signIn = useCallback(async (email: string, password: string): Promise<User | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) throw error;
    if (!data.user) return null;

    await fetchUserRecord(data.user.id);
    // Fetch the updated user record after login and return it
    // (we can't use `user` state here because it's stale in this closure)
    const { data: updatedUser } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    return (updatedUser as User) ?? null;
  }, [fetchUserRecord]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    name: string,
    churchId: string,
    role: Role = 'viewer'
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: { name, church_id: churchId, role },
      },
    });

    if (error) throw error;
    return data.user ? ({ id: 'temp', name, role } as User) : null;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      can: (perm) => (user ? PERMISSION_MATRIX[user.role].includes(perm) : false),
      hasRole: (...roles) => (user ? roles.includes(user.role) : false),
    }),
    [user, loading, signIn, signUp, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}