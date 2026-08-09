'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n';
import { formatHours } from '@/lib/report';
import {
  ANALYTICS_COLORS,
  AnalyticsTooltip,
  shortLabel,
} from './chart-tooltip';
import type { VolumeSpeedBucket } from '@/types/analytics';

interface SpeedChartsProps {
  buckets: VolumeSpeedBucket[];
}

/**
 * Section 3 — Speed & Responsiveness Trends.
 * MTTR and time-to-claim line charts (hours per period). Null points
 * (no resolutions/claims in a bucket) render as gaps via connectNulls=false.
 */
export function SpeedCharts({ buckets }: SpeedChartsProps) {
  const { t } = useTranslation();
  const interval = buckets.length <= 10 ? 0 : Math.ceil(buckets.length / 8);

  const mttrData = buckets.map((b) => ({ ...b, mttrHours: b.mttrHours }));
  const ttcData = buckets.map((b) => ({ ...b, timeToClaimHours: b.timeToClaimHours }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── MTTR ──────────────────────────────────── */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-semibold">{t.analyticsMttrTitle}</CardTitle>
          <p className="text-xs text-muted-foreground">{t.analyticsMttrDesc}</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mttrData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={interval}
                tickFormatter={shortLabel}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={34}
                tickFormatter={(v: number) => `${v} h`}
              />
              <Tooltip
                content={
                  <AnalyticsTooltip formatter={(v) => formatHours(Number(v))} />
                }
              />
              <Line
                type="monotone"
                dataKey="mttrHours"
                name={t.analyticsMetricMttr}
                stroke={ANALYTICS_COLORS.mttr}
                strokeWidth={2}
                dot={{ r: 2.5, fill: ANALYTICS_COLORS.mttr }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Time-to-claim ─────────────────────────── */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-semibold">{t.analyticsTtcTitle}</CardTitle>
          <p className="text-xs text-muted-foreground">{t.analyticsTtcDesc}</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ttcData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={interval}
                tickFormatter={shortLabel}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={34}
                tickFormatter={(v: number) => `${v} h`}
              />
              <Tooltip
                content={
                  <AnalyticsTooltip formatter={(v) => formatHours(Number(v))} />
                }
              />
              <Line
                type="monotone"
                dataKey="timeToClaimHours"
                name={t.analyticsMetricTtc}
                stroke={ANALYTICS_COLORS.timeToClaim}
                strokeWidth={2}
                dot={{ r: 2.5, fill: ANALYTICS_COLORS.timeToClaim }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
