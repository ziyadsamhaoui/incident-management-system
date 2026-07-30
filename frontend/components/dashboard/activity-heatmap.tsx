'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

// ── Mock contribution data ────────────────────────
// In production, replace with GET /api/dashboard/admin-activity?adminId=X

function generateMockData(): number[][] {
  const weeks: number[][] = [];
  for (let w = 0; w < 52; w++) {
    const days: number[] = [];
    for (let d = 0; d < 5; d++) {
      // Random activity count: 0-5 with ~40% chance of 0
      days.push(Math.random() < 0.4 ? 0 : Math.floor(Math.random() * 5) + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

// ── Color intensity levels ────────────────────────

const INTENSITY_LEVELS = [
  { threshold: 0, className: 'bg-green-50 dark:bg-green-950/40' },
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

function getMonthLabels(): { index: number; label: string }[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const labels: { index: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = (currentMonth - 11 + i + 12) % 12;
    // Only include months that align with week boundaries (approximate)
    const weekIndex = Math.floor(i * 52 / 12);
    if (i === 0 || labels[labels.length - 1].label !== MONTH_LABELS[monthIndex]) {
      labels.push({ index: weekIndex, label: MONTH_LABELS[monthIndex] });
    }
  }
  return labels;
}

// ── Day labels ────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']; // Mon — Fri

// ── Component ─────────────────────────────────────

export function ActivityHeatmap() {
  const data = useMemo(() => generateMockData(), []);
  const monthLabels = useMemo(() => getMonthLabels(), []);

  // Calculate total actions
  const totalActions = useMemo(
    () => data.reduce((sum, week) => sum + week.reduce((s, d) => s + d, 0), 0),
    [data],
  );

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
            Contribution
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col h-full">            <div className="flex items-start gap-1.5 flex-1">
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
                    key={index}
                    className="text-[8px] font-medium text-muted-foreground"                      style={{ marginLeft: index > 0 ? `${(index - monthLabels[monthLabels.findIndex(m => m.index === index) - 1]?.index ?? 0) * 100}px` : undefined }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Week grid */}
              <div className="flex gap-[4px]">
                {data.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[4px]">
                    {week.map((count, dIdx) => (
                      <div
                        key={dIdx}
                        className={cn(
                          'h-4 w-4 rounded-sm transition-colors',
                          getIntensityClass(count),
                          count > 0 && 'hover:ring-1 hover:ring-green-500/50',
                        )}
                        title={`${count} évaluation${count > 1 ? 's' : ''}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

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
              <span className="font-semibold text-foreground">{totalActions}</span> évaluations
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
