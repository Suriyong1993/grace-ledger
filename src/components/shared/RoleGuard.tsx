import type { ReactNode } from "react";
import { useAuth, type Permission } from "@/lib/auth";

export function Can({
  perm,
  children,
  fallback = null,
}: {
  perm: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(perm) ? children : fallback}</>;
}
