/**
 * Shared skeleton primitives used by all dashboard pages.
 *
 * Instead of every page duplicating its own skeleton, these
 * building blocks compose into page-specific layouts.
 *
 * Usage:
 *   import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
 */

import { cn } from "@/lib/utils";

/** Base pulsing block */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded bg-muted/40", className)}
      {...props}
    />
  );
}

/** Glass card with shimmer content */
export function SkeletonCard({ className }) {
  return (
    <div className={cn("glass-card p-5 space-y-3", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-full opacity-50" />
    </div>
  );
}

/** KPI row of 4 cards */
export function SkeletonKpiRow({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Full-height chart block */
export function SkeletonChart({ className }) {
  return (
    <div className={cn("glass-card p-6 animate-pulse bg-muted/10", className)} />
  );
}

/** Table rows */
export function SkeletonTable({ rows = 8, cols = 5 }) {
  return (
    <div className="glass-card overflow-hidden">
      {/* header */}
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-4 border-b border-border/50 px-4 py-3">
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton
              key={ci}
              className="h-3 flex-1"
              style={{ opacity: 1 - ri * 0.08 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Page header block */
export function SkeletonPageHeader() {
  return (
    <div className="space-y-1.5 mb-6">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-4 w-80 opacity-60" />
    </div>
  );
}

/** Generic full-page skeleton — fallback for ErrorBoundary */
export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonKpiRow />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonChart className="lg:col-span-2 h-72" />
        <SkeletonChart className="h-72" />
      </div>
    </div>
  );
}
