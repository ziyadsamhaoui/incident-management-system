'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Inbox } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/lib/use-async';
import { getAdminActivity } from '@/services/dashboardService';
import type { AdminActivityEntry } from '@/types/dashboard';

// ── Color intensity levels ────────────────────────
// 0 = dark gray (light) / light gray (dark), then soft green → deep green

const INTENSITY_LEVELS = [
  { threshold: 0, className: 'bg-slate-300 dark:bg-slate-700' },
  { threshold: 1, className: 'bg-green-200 dark:bg-green-900/40' },
  { threshold: 2, className: 'bg-green-400 dark:bg-green-700/50' },
  { threshold: 4, className: 'bg-green-600 dark:bg-green-600/60' },
  { threshold: 6, className: 'bg-green-800 dark:bg-green-500/70' },
];

function getIntensityClass(count: number): string {
  for (let i = INTENSITY_LEVELS.length - 1; i >= 0; i--) {
    if (count >= INTENSITY_LEVELS[i].threshold) {
      return INTENSITY_LEVELS[i].className;
    }
  }
  return INTENSITY_LEVELS[0].className;
}

// ── Month label helper ────────────────────────────

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// ── Day labels ────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']; // Mon — Fri

// ── Hover Tooltip ─────────────────────────────────

function HeatmapTooltip({
  count,
  x,
  y,
  unit,
}: {
  count: number;
  x: number;
  y: number;
  unit: string;
}) {
  return (
    <div
      className="fixed z-50 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium shadow-lg dark:border-slate-700 dark:bg-slate-800"
      style={{
        left: x + 10,
        top: y - 30,
        pointerEvents: 'none',
      }}
    >
      {count > 0
        ? `${count} ${unit}${count > 1 ? 's' : ''}`
        : `Aucune ${unit}`}
    </div>
  );
}

interface ActivityHeatmapProps {
  /** Optional pre-fetched daily buckets ({date, count}). When provided, no fetch happens. */
  data?: Array<{ date: string; count: number }>;
  title?: string;
  /** Empty-state copy when the period has no activity. */
  emptyLabel?: string;
  /** Unit used in the tooltip and total (e.g. 'évaluation', 'déclaration'). */
  unit?: string;
}

/**
 * GitHub-style activity grid built from real daily counts. By default it
 * fetches evaluations (`GET /api/dashboard/admin-activity`); pass {@code data}
 * to render pre-fetched buckets (e.g. per-user declarations/resolutions).
 * Renders a dedicated empty state when the period has no activity.
 */
export function ActivityHeatmap({
  data: externalData,
  title = 'Contribution',
  emptyLabel = 'Aucune évaluation enregistrée sur cette période.',
  unit = 'évaluation',
}: ActivityHeatmapProps) {
  const { data: fetched, loading, error, refetch } = useAsync<AdminActivityEntry[]>(
    () => (externalData === undefined ? getAdminActivity() : Promise.resolve([])),
    [externalData === undefined],
  );

  // Pre-fetched buckets win; otherwise fall back to the fetched endpoint data.
  const data = externalData ?? fetched ?? [];
  const isLoading = externalData === undefined && loading;

  // ── Build the 52-week × 5-day grid from real counts ──
  const grid = useMemo(() => {
    if (!data) return { weeks: [], total: 0 };
    const byDate = new Map(data.map((e) => [e.date, e.count]));
    const weeks: number[][] = [];
    const now = new Date();
    // Walk back ~51 weeks of business days from today
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    const daySeries: Date[] = [];
    let day = new Date(cursor);
    day.setDate(day.getDate() - 6); // current partial week
    while (day <= cursor) {
      daySeries.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }
    const weekCount = 52;
    const padded: Date[] = [];
    for (let w = weekCount - 1; w >= 0; w--) {
      const weekStart = new Date(cursor);
      weekStart.setDate(cursor.getDate() - (7 * w + (cursor.getDay() || 7) - 1));
      for (let d = 0; d < 5; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        padded.push(date);
      }
    }
    padded.forEach((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      daySeries.push(date);
      if (weeks.length === 0 || weeks[weeks.length - 1].length === 5) weeks.push([]);
      weeks[weeks.length - 1].push(byDate.get(key) ?? 0);
    });
    // Trim leading partial weeks to a max of 52
    while (weeks.length > 52) weeks.shift();
    const total = data.reduce((sum, e) => sum + e.count, 0);
    return { weeks, total };
  }, [data]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { index: number; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const monthIndex = (now.getMonth() - 11 + i + 12) % 12;
      labels.push({ index: Math.floor(i * 52 / 12), label: MONTH_LABELS[monthIndex] });
    }
    return labels;
  }, []);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ count: number; x: number; y: number } | null>(null);

  const handleMouseEnter = useCallback(
    (count: number, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ count, x: rect.left, y: rect.top });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : error ? (
            <ErrorState message={error} compact onRetry={refetch} />
          ) : !data || data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {emptyLabel}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-1.5">
                {/* Day labels column */}
                <div className="flex flex-col gap-[3px] pt-5 mr-1">
                  {DAY_LABELS.map((label) => (
                    <span key={label} className="h-4 text-[9px] font-medium text-muted-foreground leading-4">
                      {label}
                    </span>
                  ))}
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-x-auto">
                  {/* Month labels */}
                  <div className="flex gap-[4px] mb-1.5">
                    {monthLabels.map(({ index, label }) => (
                      <span
                        key={`${index}-${label}`}
                        className="text-[8px] font-medium text-muted-foreground"
                        style={{ marginLeft: index * 4 }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* Week grid */}
                  <div className="flex gap-[4px]">
                    {grid.weeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-[4px]">
                        {week.map((count, dIdx) => (
                          <div
                            key={dIdx}
                            onMouseEnter={(e) => handleMouseEnter(count, e)}
                            onMouseLeave={handleMouseLeave}
                            className={cn(
                              'h-4 w-4 rounded-sm transition-colors cursor-pointer',
                              getIntensityClass(count),
                              count > 0 && 'hover:ring-1 hover:ring-green-500/50',
                            )}
                            title={`${count} ${unit}${count > 1 ? 's' : ''}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tooltip */}
              {tooltip && (
                <HeatmapTooltip count={tooltip.count} x={tooltip.x} y={tooltip.y} unit={unit} />
              )}

              {/* Legend & Stats */}
              <div className="flex items-center justify-between mt-auto pt-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Moins</span>
                  {INTENSITY_LEVELS.map((level, idx) => (
                    <div
                      key={idx}
                      className={cn('h-4 w-4 rounded-sm', level.className)}
                    />
                  ))}
                  <span className="text-[10px] text-muted-foreground">Plus</span>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  <span className="font-semibold text-foreground">{grid.total}</span>{' '}
                  {unit}{grid.total > 1 ? 's' : ''}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
