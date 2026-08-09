'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  ShieldCheck,
  Timer,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n';
import { formatHours } from '@/lib/report';
import type { MetricDelta, VolumeSpeedDeltas, VolumeSpeedTotals } from '@/types/analytics';

/** Green/red badge respecting metric polarity (higher-is-better vs lower-is-better). */
function DeltaBadge({ delta, compare }: { delta: MetricDelta | null; compare: boolean }) {
  const { t } = useTranslation();
  if (!compare || !delta || delta.pct == null) {
    if (!compare) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60">
        <Minus className="h-3 w-3" />
        {t.analyticsNoCompare}
      </span>
    );
  }

  const improved = delta.goodWhenUp ? delta.pct > 0 : delta.pct < 0;
  const flat = delta.pct === 0;
  const Arrow = delta.pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        flat
          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          : improved
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      )}
    >
      <Arrow className="h-3 w-3" />
      {Math.abs(delta.pct).toFixed(1)} %
      <span className="hidden sm:inline font-normal opacity-70">{t.analyticsVsPrev}</span>
    </span>
  );
}

interface SummaryStripProps {
  totals: VolumeSpeedTotals;
  deltas: VolumeSpeedDeltas | null;
  compare: boolean;
}

const TILES: {
  key: 'reported' | 'resolutionRate' | 'mttr' | 'timeToClaim';
  labelKey: string;
  icon: React.ElementType;
  accent: string;
}[] = [
  { key: 'reported', labelKey: 'analyticsMetricTotal', icon: FileText, accent: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  { key: 'resolutionRate', labelKey: 'analyticsMetricRate', icon: ShieldCheck, accent: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
  { key: 'mttr', labelKey: 'analyticsMetricMttr', icon: Timer, accent: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
  { key: 'timeToClaim', labelKey: 'analyticsMetricTtc', icon: Zap, accent: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
];

/** Period summary — 4 metrics, each with its period-over-period delta badge. */
export function SummaryStrip({ totals, deltas, compare }: SummaryStripProps) {
  const { t } = useTranslation();

  const values: Record<string, { display: string; delta: MetricDelta | null }> = {
    reported: {
      display: totals.reported.toLocaleString('fr-FR'),
      delta: deltas?.reported ?? null,
    },
    resolutionRate: {
      display: `${totals.resolutionRatePct.toFixed(1)} %`,
      delta: deltas?.resolutionRate ?? null,
    },
    mttr: {
      display: formatHours(totals.mttrHours),
      delta: deltas?.mttr ?? null,
    },
    timeToClaim: {
      display: formatHours(totals.timeToClaimHours),
      delta: deltas?.timeToClaim ?? null,
    },
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((tile, idx) => {
        const Icon = tile.icon;
        const v = values[tile.key];
        return (
          <motion.div
            key={tile.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
          >
            <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t[tile.labelKey]}
                  </span>
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tile.accent)}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="text-xl font-bold tracking-tight">{v.display}</div>
                <div className="mt-1.5">
                  <DeltaBadge delta={v.delta} compare={compare} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
