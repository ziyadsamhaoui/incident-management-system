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

// ── Day labels (Mon–Fri) ──────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

// ── Grid layout constants ─────────────────────────

const CELL_SIZE = 16; // px — matches `h-4 w-4`
const CELL_GAP = 4;   // px — matches `gap-[4px]`
const COL_WIDTH = CELL_SIZE + CELL_GAP; // 20px per column

// ── Build weeks ───────────────────────────────────
// Single source of truth: every column and label is derived from this.

interface Day {
  date: Date;
  count: number;
}

interface Week {
  days: Day[]; // Mon–Fri (indices 0–4)
}

/**
 * Build all weeks between `startDate` (inclusive) and `endDate` (inclusive).
 * startDate is aligned back to its Monday; endDate stops at today.
 * Each week contains up to 5 weekdays (Mon–Fri), matching the design.
 */
function buildWeeks(
  startDate: Date,
  endDate: Date,
  byDate: Map<string, number>,
): Week[] {
  // Align startDate back to Monday
  const aligned = new Date(startDate);
  const dayOfWeek = aligned.getDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0 … Sun=6
  aligned.setDate(aligned.getDate() - daysSinceMonday);

  const weeks: Week[] = [];
  const cursor = new Date(aligned);

  while (cursor <= endDate) {
    const days: Day[] = [];
    // Mon–Fri (indices 0–4)
    for (let d = 0; d < 5; d++) {
      const dayDate = new Date(cursor);
      dayDate.setDate(cursor.getDate() + d);
      // Don't add future days
      if (dayDate > endDate) break;
      const key = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      days.push({ date: dayDate, count: byDate.get(key) ?? 0 });
    }
    if (days.length > 0) {
      weeks.push({ days });
    }
    // Advance to next Monday
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

/**
 * Derive month labels from the weeks array.
 * A label is placed only where the month changes.
 */
function getMonthLabels(weeks: Week[]): { columnIndex: number; label: string }[] {
  const labels: { columnIndex: number; label: string }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, columnIndex) => {
    const firstDay = week.days[0]?.date;
    if (!firstDay) return;
    const month = firstDay.getMonth();
    if (month !== lastMonth) {
      labels.push({
        columnIndex,
        label: firstDay.toLocaleString('fr-FR', { month: 'short' }),
      });
      lastMonth = month;
    }
  });

  return labels;
}

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

// ── Props ─────────────────────────────────────────

interface ActivityHeatmapProps {
  /** Optional pre-fetched daily buckets ({date, count}). When provided, no fetch happens. */
  data?: Array<{ date: string; count: number }>;
  title?: string;
  /** Empty-state copy when the period has no activity. */
  emptyLabel?: string;
  /** Unit used in the tooltip and total (e.g. 'évaluation', 'déclaration'). */
  unit?: string;
}

// ── Main Component ────────────────────────────────

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

  const data = externalData ?? fetched ?? [];
  const isLoading = externalData === undefined && loading;

  // ── Build weeks from data — single source of truth ──
  const { weeks, monthLabels, total } = useMemo(() => {
    if (!data || data.length === 0) {
      return { weeks: [], monthLabels: [], total: 0 };
    }

    const byDate = new Map(data.map((e) => [e.date, e.count]));

    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);

    // Start 1 year back from today
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);

    const w = buildWeeks(startDate, endDate, byDate);
    const labels = getMonthLabels(w);
    const totalCount = data.reduce((sum, e) => sum + e.count, 0);

    return { weeks: w, monthLabels: labels, total: totalCount };
  }, [data]);

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

  // Grid width: weeks.length columns × (cellSize + gap)
  const gridWidth = weeks.length * COL_WIDTH;

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

                {/* Scrollable grid wrapper */}
                <div className="flex-1 overflow-x-auto">
                  {/* Month labels — absolutely positioned to align with columns */}
                  <div className="relative mb-1.5" style={{ height: 14 }}>
                    {monthLabels.map(({ columnIndex, label }) => (
                      <span
                        key={`${columnIndex}-${label}`}
                        className="absolute top-0 text-[8px] font-medium text-muted-foreground"
                        style={{ left: columnIndex * COL_WIDTH }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* Week grid */}
                  <div
                    className="flex gap-[4px]"
                    style={{ width: gridWidth }}
                  >
                    {weeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-[4px]">
                        {week.days.map((day, dIdx) => (
                          <div
                            key={dIdx}
                            onMouseEnter={(e) => handleMouseEnter(day.count, e)}
                            onMouseLeave={handleMouseLeave}
                            className={cn(
                              'h-4 w-4 rounded-sm transition-colors cursor-pointer',
                              getIntensityClass(day.count),
                              day.count > 0 && 'hover:ring-1 hover:ring-green-500/50',
                            )}
                            title={`${day.count} ${unit}${day.count > 1 ? 's' : ''}`}
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
                  <span className="font-semibold text-foreground">{total}</span>{' '}
                  {unit}{total > 1 ? 's' : ''}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
