'use client';

import { CalendarRange, GitCompareArrows, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export type RangePreset = '7' | '30' | '90' | 'ytd' | 'custom';

export const RANGE_PRESETS: { value: RangePreset; labelKey: string }[] = [
  { value: '7', labelKey: 'analyticsPreset7' },
  { value: '30', labelKey: 'analyticsPreset30' },
  { value: '90', labelKey: 'analyticsPreset90' },
  { value: 'ytd', labelKey: 'analyticsPresetYtd' },
  { value: 'custom', labelKey: 'analyticsPresetCustom' },
];

interface AnalyticsControlsProps {
  preset: RangePreset;
  onPresetChange: (p: RangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
  departmentId: number | '';
  onDepartmentChange: (id: number | '') => void;
  departmentOptions: { value: string; label: string }[];
  compare: boolean;
  onCompareChange: (v: boolean) => void;
}

/** Global control bar driving every widget on the /analytics page. */
export function AnalyticsControls({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomChange,
  departmentId,
  onDepartmentChange,
  departmentOptions,
  compare,
  onCompareChange,
}: AnalyticsControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* ── Date range presets ─────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.analyticsFrom}</span>
            <span className="hidden sm:inline">—</span>
            <span className="hidden sm:inline">{t.analyticsTo}</span>
          </span>
          <div className="flex flex-wrap rounded-lg border bg-muted p-0.5">
            {RANGE_PRESETS.map((presetDef) => {
              const isActive = preset === presetDef.value;
              return (
                <button
                  key={presetDef.value}
                  type="button"
                  onClick={() => onPresetChange(presetDef.value)}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t[presetDef.labelKey]}
                </button>
              );
            })}
          </div>

          {/* Custom range inputs — revealed when the Custom preset is active */}
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => onCustomChange(e.target.value, customTo)}
                aria-label={t.analyticsFrom}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => onCustomChange(customFrom, e.target.value)}
                aria-label={t.analyticsTo}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* ── Right side: department filter + compare toggle ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={departmentId}
              onChange={(e) =>
                onDepartmentChange(
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
              className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-muted-foreground outline-none appearance-none cursor-pointer hover:border-muted-foreground/30"
            >
              <option value="">{t.analyticsAllDepartments}</option>
              {departmentOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Comparison toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={compare}
            aria-label={t.analyticsCompare}
            title={t.analyticsCompareHint}
            onClick={() => onCompareChange(!compare)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
              compare
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-input text-muted-foreground hover:border-muted-foreground/30',
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">{t.analyticsCompare}</span>
            <span
              className={cn(
                'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
                compare ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            >
              <span
                className={cn(
                  'absolute h-3 w-3 rounded-full bg-white shadow transition-transform',
                  compare ? 'translate-x-3.5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
