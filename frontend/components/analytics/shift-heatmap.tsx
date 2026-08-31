'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { HeatmapResponse } from '@/types/analytics';

interface ShiftHeatmapProps {
  heatmap: HeatmapResponse;
}

const DAY_KEYS = [
  'analyticsDayMon',
  'analyticsDayTue',
  'analyticsDayWed',
  'analyticsDayThu',
  'analyticsDayFri',
];

const HOUR_TICKS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/**
 * Section 5 — Shift / time-of-day heatmap.
 * 2D matrix (Hour of Day [00–23] × Day of Week [Mon–Sun]); cell intensity
 * reflects incident density, surfacing peak failure windows per shift.
 */
export function ShiftHeatmap({ heatmap }: ShiftHeatmapProps) {
  const { t } = useTranslation();

  // Sparse cells → dense 7×24 lookup.
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const cell of heatmap.cells) {
    grid[cell.dayOfWeek][cell.hour] = cell.count;
    if (cell.count > max) max = cell.count;
  }

  // Filter for Mon-Fri and 07:00-19:00
  const displayGrid = grid.slice(0, 5).map((row) => row.slice(7, 20));

  const cellOpacity = (count: number): number => {
    if (count === 0) return 0.06;
    if (max <= 1) return 0.55;
    return 0.2 + 0.8 * (count / max);
  };

  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-semibold">{t.analyticsHeatmapTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t.analyticsHeatmapDesc} · {t.analyticsHeatmapTotal.replace('{count}', String(heatmap.totalCount))}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[560px] flex flex-col gap-2">
            {/* Hour header row */}
            <div className="grid" style={{ gridTemplateColumns: '44px repeat(13, minmax(18px, 1fr))', gap: 2 }}>
              <div />
              {HOUR_TICKS.map((h) => (
                <div
                  key={h}
                  className="text-center text-[9px] font-medium text-muted-foreground"
                  style={{ gridColumnStart: h - 7 + 2, gridColumnEnd: h - 7 + 3 }}
                >
                  {String(h).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {/* Day rows */}
            {displayGrid.map((row, dayIdx) => (
              <div
                key={dayIdx}
                className="grid items-center"
                style={{ gridTemplateColumns: '44px repeat(13, minmax(18px, 1fr))', gap: 2 }}
              >
                <span className="text-[10px] font-medium text-muted-foreground">
                  {t[DAY_KEYS[dayIdx]]}
                </span>
                {row.map((count, hourIdx) => {
                  const actualHour = 7 + hourIdx;
                  const hourLabel =
                    actualHour === 12
                      ? '12 PM'
                      : actualHour > 12
                        ? `${actualHour - 12} PM`
                        : `${actualHour} AM`;
                  return (
                    <div
                      key={hourIdx}
                      title={count > 0 ? `${count} incidents at ${hourLabel}` : ''}
                      className={cn(
                        'aspect-square rounded-[3px] transition-transform w-4/5 m-auto',
                        count > 0 && 'hover:scale-110 hover:ring-1 hover:ring-slate-400',
                      )}
                      style={{
                        backgroundColor: `rgb(59 130 246 / ${cellOpacity(count)})`,
                        boxShadow: count > 0 ? 'inset 0 0 0 1px rgba(59,130,246,0.25)' : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
              <span>{t.analyticsHeatmapLow}</span>
              <div className="flex gap-0.5">
                {[0.06, 0.25, 0.45, 0.7, 0.95].map((o) => (
                  <span
                    key={o}
                    className="h-3 w-5 rounded-sm"
                    style={{ backgroundColor: `rgb(59 130 246 / ${o})` }}
                  />
                ))}
              </div>
              <span>{t.analyticsHeatmapHigh}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
