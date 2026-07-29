/**
 * Grace Ledger v2 — Loading Skeleton Components
 *
 * Reusable skeleton placeholders for data-loading states.
 * Prevents layout shift and improves perceived performance.
 */

import { cn } from "@/lib/utils";

// ============================================================================
// Base Skeleton
// ============================================================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-sm bg-muted/70", className)} aria-hidden="true" />
  );
}

// ============================================================================
// Card Skeleton
// ============================================================================

export function CardSkeleton() {
  return (
    <div className="card-ledger p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="mt-1">
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

// ============================================================================
// Stat Card Skeleton
// ============================================================================

export function StatCardSkeleton() {
  return (
    <div className="card-ledger p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <div className="mt-2">
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="mt-1">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ============================================================================
// Stat Grid Skeleton (4 cards in a row)
// ============================================================================

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// Table Row Skeleton
// ============================================================================

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className={cn("h-4", i === 0 ? "w-32" : i === columns - 1 ? "w-16" : "w-24")} />
        </td>
      ))}
    </tr>
  );
}

// ============================================================================
// Table Skeleton
// ============================================================================

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="card-ledger overflow-hidden">
      {/* Table header */}
      <div className="border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Dashboard Skeleton
// ============================================================================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatGridSkeleton count={4} />

      {/* Charts area */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-ledger p-4">
          <Skeleton className="h-4 w-36" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <div className="card-ledger p-4">
          <Skeleton className="h-4 w-36" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card-ledger p-4">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4">
          <TableSkeleton rows={4} columns={5} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Form Skeleton
// ============================================================================

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="card-ledger space-y-5 p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="mt-2 h-10 w-28" />
    </div>
  );
}

// ============================================================================
// Page Header Skeleton
// ============================================================================

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="space-y-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

// ============================================================================
// Full Page Skeleton (wraps header + content)
// ============================================================================

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FormSkeleton fields={3} />
    </div>
  );
}
