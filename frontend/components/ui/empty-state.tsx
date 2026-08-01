'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
  /** Lucide icon rendered in a muted slate circle */
  icon?: React.ElementType;
  title: string;
  description?: ReactNode;
  /** Optional actionable CTA button label */
  actionLabel?: string;
  /** Click handler for the CTA (falls back to href if provided) */
  onAction?: () => void;
  /** Alternative: navigate to a route when the CTA is clicked */
  actionHref?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Standardized, actionable zero-data empty state.
 * Rendered whenever an API returns an empty list (data.length === 0).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-10 px-4' : 'py-16 px-4',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Icon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {actionLabel && (
        <Button
          size="sm"
          className="mt-5 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => {
            if (onAction) onAction();
            else if (actionHref) window.location.href = actionHref;
          }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
