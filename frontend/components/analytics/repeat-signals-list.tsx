'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Cpu, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CardListSkeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n';
import { fullDate } from './chart-tooltip';
import type { RepeatSignal } from '@/types/analytics';

interface RepeatSignalsListProps {
  signals: RepeatSignal[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * Section 6 — Rule-based repeat-incident signals (SQL windowing).
 * Alert callout cards (not a chart) surfacing recurring equipment failures,
 * each with a direct deep link into the filtered incident search view.
 */
export function RepeatSignalsList({
  signals,
  loading,
  error,
  onRetry,
}: RepeatSignalsListProps) {
  const { t } = useTranslation();

  return (
    <Card className="h-full">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {t.analyticsSignalsTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t.analyticsSignalsDesc}</p>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {loading ? (
          <CardListSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error} compact onRetry={onRetry} />
        ) : signals.length === 0 ? (
          <EmptyState
            compact
            icon={Cpu}
            title={t.analyticsSignalsEmpty}
            description={t.analyticsSignalsEmptyDesc}
          />
        ) : (
          signals.map((signal, idx) => (
            <motion.div
              key={`${signal.stationId}-${signal.categoryId}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * idx, duration: 0.25 }}
              className="group rounded-xl border border-amber-200 bg-amber-50/60 p-3 transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate text-sm font-bold text-amber-800 dark:text-amber-300">
                    {signal.stationCode ?? `#${signal.stationId}`}
                  </span>
                  {signal.departmentName && (
                    <Badge variant="outline" className="shrink-0 border-amber-300 px-1.5 py-0 text-[9px] text-amber-700 dark:border-amber-800 dark:text-amber-400">
                      {signal.departmentName}
                    </Badge>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-400 bg-white px-1.5 py-0 text-[10px] font-bold text-amber-700 dark:border-amber-700 dark:bg-transparent dark:text-amber-400"
                >
                  {t.analyticsSignalsCount.replace('{n}', String(signal.incidentCount))}
                </Badge>
              </div>

              <p className="mt-1.5 text-xs font-medium text-amber-700/90 dark:text-amber-400/90">
                « {signal.categoryName ?? '—'} »
                {signal.firstOccurrence &&
                  ` · ${t.analyticsSignalsSince.replace('{date}', fullDate(signal.firstOccurrence.slice(0, 10)))}`}
              </p>

              {signal.latestIncidentId && (
                <Link
                  href={`/admin/incidents/${signal.latestIncidentId}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t.analyticsSignalsOpen} · {signal.latestReference}
                </Link>
              )}
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
