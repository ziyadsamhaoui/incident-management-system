'use client';

import { cn } from '@/lib/utils';

/** Base pulsing block */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      style={style}
    />
  );
}

/** Table skeleton — matches the exact row/column structure of a data table. */
export function TableSkeleton({
  rows = 5,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton
            key={`h-${c}`}
            className={cn('h-3', c === 0 ? 'w-24' : c === columns - 1 ? 'w-10' : 'flex-1')}
          />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={`r-${r}-${c}`}
              className={cn(
                'h-4',
                c === 0 ? 'w-24' : c === columns - 1 ? 'w-8' : 'flex-1',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card list skeleton — for kiosk card feeds and list pages. */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Stat grid skeleton — matches the 6-card dashboard stat row. */
export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Chart block skeleton — matches chart card dimensions. */
export function ChartBlockSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 w-full rounded-lg" style={{ height }} />
    </div>
  );
}
