import { cn } from '@/lib/utils';

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted-foreground/20" />
      </div>
      <div className="h-7 w-20 animate-pulse rounded bg-muted-foreground/20" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <div className="flex h-14 animate-pulse items-center gap-4 border-b px-4">
      <div className="h-3 w-8 rounded bg-muted-foreground/20" />
      <div className="h-3 w-32 rounded bg-muted-foreground/20" />
      <div className="h-3 w-20 rounded bg-muted-foreground/20" />
      <div className="h-3 w-24 rounded bg-muted-foreground/20" />
      <div className="h-3 w-16 rounded bg-muted-foreground/20" />
      <div className="ml-auto h-3 w-12 rounded bg-muted-foreground/20" />
    </div>
  );
}

export default function AdminLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Skeleton header */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted-foreground/10" />
      </div>

      {/* Skeleton stat cards (6-card grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Skeleton chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="h-5 w-36 animate-pulse rounded bg-muted-foreground/20" />
          <div className="flex items-center justify-center h-48">
            <div className="h-40 w-40 animate-pulse rounded-full bg-muted-foreground/10" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="h-5 w-36 animate-pulse rounded bg-muted-foreground/20" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-full animate-pulse rounded bg-muted-foreground/10" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted-foreground/20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skeleton table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="h-5 w-32 animate-pulse rounded bg-muted-foreground/20" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
    </div>
  );
}
