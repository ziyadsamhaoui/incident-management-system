'use client';

import { HardDrive, Image as ImageIcon, Film, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/services/mediaService';
import type { AdminMediaStats } from '@/types/media';
import { Skeleton } from '@/components/ui/skeleton';

interface StorageSummaryStripProps {
  stats: AdminMediaStats | null;
  loading: boolean;
  onRetry: () => void;
}

/**
 * Top overview banner of /admin/media — answers "Are we running out of disk?"
 * at a glance: total stored bytes (DB-side SUM), photo vs video breakdown, and
 * real host disk headroom (Files.getFileStore().getUsableSpace()).
 */
export function StorageSummaryStrip({ stats, loading, onRetry }: StorageSummaryStripProps) {
  if (loading) {
    return (
      <div className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <Skeleton className="h-14 w-40" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-36" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">Impossible de charger les statistiques de stockage.</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/40"
        >
          <RefreshCw className="h-3 w-3" />
          Réessayer
        </button>
      </div>
    );
  }

  const usedRatio = stats.totalBytes > 0 ? stats.storedBytes / stats.totalBytes : 0;
  const usedPercent = Math.round(usedRatio * 100);
  const photoRatio = stats.storedBytes > 0 ? stats.photoBytes / stats.storedBytes : 0;
  const critical = usedRatio >= 0.9;
  const warning = usedRatio >= 0.8;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      {!stats.configured && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Stockage média non configuré sur ce serveur : les statistiques proviennent de la base
            de données et les nouveaux dépôts de fichiers répondront en 503.
          </span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        {/* Total stored */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stockage des médias
            </p>
            <p className="text-2xl font-bold tracking-tight">{formatFileSize(stats.storedBytes)}</p>
            <p className="text-xs text-muted-foreground">
              {stats.totalCount} fichier{stats.totalCount > 1 ? 's' : ''} ·{' '}
              {stats.photoCount} photo{stats.photoCount > 1 ? 's' : ''} · {stats.videoCount} vidéo
              {stats.videoCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Photo / Video breakdown bar */}
        <div className="min-w-0">
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Photos ${formatFileSize(stats.photoBytes)}, vidéos ${formatFileSize(stats.videoBytes)}`}
          >
            {stats.photoBytes > 0 && (
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${photoRatio * 100}%` }} />
            )}
            {stats.videoBytes > 0 && (
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(1 - photoRatio) * 100}%` }} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
              <ImageIcon className="h-3.5 w-3.5" />
              Photos · {formatFileSize(stats.photoBytes)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
              <Film className="h-3.5 w-3.5" />
              Vidéos · {formatFileSize(stats.videoBytes)}
            </span>
          </div>
        </div>

        {/* Disk headroom */}
        <div className="md:text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Espace disque libre
          </p>
          <p className="text-xl font-bold tracking-tight">{formatFileSize(stats.usableBytes)}</p>
          <p className="text-xs text-muted-foreground">sur {formatFileSize(stats.totalBytes)}</p>
          <span
            className={cn(
              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
              critical
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                : warning
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            )}
          >
            {critical ? '⚠ Stockage presque saturé' : `${usedPercent} % du disque utilisé`}
          </span>
        </div>
      </div>
    </div>
  );
}
