'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n';
import {
  ANALYTICS_COLORS,
  AnalyticsTooltip,
  shortLabel,
} from './chart-tooltip';
import type { VolumeSpeedBucket } from '@/types/analytics';

function axisInterval(buckets: unknown[]): number {
  if (buckets.length <= 10) return 0;
  return Math.ceil(buckets.length / 8);
}

interface VolumeChartsProps {
  buckets: VolumeSpeedBucket[];
}

/**
 * Section 2 — Volume & Resolution Quality Trends.
 * Dual-layer area chart (reported volume) + stacked area (RESOLVED vs
 * NON_RESOLVED outcome proportion) fed entirely by server-side buckets.
 */
export function VolumeCharts({ buckets }: VolumeChartsProps) {
  const { t } = useTranslation();
  const interval = axisInterval(buckets);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Incident volume over time ─────────────── */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-semibold">{t.analyticsVolumeTitle}</CardTitle>
          <p className="text-xs text-muted-foreground">{t.analyticsVolumeDesc}</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={buckets} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="volReported" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ANALYTICS_COLORS.reported} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ANALYTICS_COLORS.reported} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={interval}
                tickFormatter={shortLabel}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
              <Tooltip
                content={
                  <AnalyticsTooltip formatter={(v) => String(v)} />
                }
              />
              <Area
                type="monotone"
                dataKey="reported"
                name={t.analyticsVolumeTitle}
                stroke={ANALYTICS_COLORS.reported}
                strokeWidth={2}
                fill="url(#volReported)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Outcome quality proportion ────────────── */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-semibold">{t.analyticsOutcomeTitle}</CardTitle>
          <p className="text-xs text-muted-foreground">{t.analyticsOutcomeDesc}</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={buckets} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={interval}
                tickFormatter={shortLabel}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
              <Tooltip content={<AnalyticsTooltip formatter={(v) => String(v)} />} />
              <Area
                type="monotone"
                stackId="outcome"
                dataKey="resolved"
                name={t.analyticsResolved}
                stroke={ANALYTICS_COLORS.resolved}
                fill={ANALYTICS_COLORS.resolved}
                fillOpacity={0.75}
              />
              <Area
                type="monotone"
                stackId="outcome"
                dataKey="nonResolved"
                name={t.analyticsNonResolved}
                stroke={ANALYTICS_COLORS.nonResolved}
                fill={ANALYTICS_COLORS.nonResolved}
                fillOpacity={0.75}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
