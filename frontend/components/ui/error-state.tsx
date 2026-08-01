'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Inline error banner rendered on API fetch failure (500, network drop, 404…).
 * Always exposes an explicit [Réessayer] retry button.
 */
export function ErrorState({
  message = 'Une erreur est survenue lors du chargement des données.',
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400',
        compact ? 'py-3' : 'py-4',
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="h-8 shrink-0 gap-1.5 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Réessayer
        </Button>
      )}
    </div>
  );
}
