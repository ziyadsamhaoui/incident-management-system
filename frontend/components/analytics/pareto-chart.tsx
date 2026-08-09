'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n';
import {
  ANALYTICS_COLORS,
  AnalyticsTooltip,
} from './chart-tooltip';
import type { ParetoResponse } from '@/types/analytics';

interface ParetoChartProps {
  pareto: ParetoResponse;
}

/**
 * Section 4 — Industrial Pareto (80/20) analysis.
 * Bars = incident counts per category (strictly descending); the right-axis
 * line is the cumulative percentage curve (0 → 100 %). The banner highlights
 * how many top categories already concentrate ~80 % of the incidents.
 */
export function ParetoChart({ pareto }: ParetoChartProps) {
  const { t } = useTranslation();
  const { categories, insight } = pareto;

  // Index where the cumulative curve first reaches 80 % — bars beyond it get
  // a muted shade, giving an instant visual read of the Pareto boundary.
  const thresholdIndex = insight ? insight.categoriesTo80 - 1 : categories.length - 1;

  const insightText = insight
    ? t.analyticsParetoInsight
        .replace('{n}', String(insight.categoriesTo80))
        .replace('{total}', String(insight.totalCategories))
        .replace('{pct}', insight.pctCovered.toFixed(1))
    : null;

  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-semibold">{t.analyticsParetoTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">{t.analyticsParetoDesc}</p>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {/* Insight banner */}
        {insightText && (
          <div className="mx-2 mb-3 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-900 dark:bg-blue-950/40">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {insightText}
            </p>
          </div>
        )}

        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={categories} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval={categories.length > 8 ? 1 : 0}
            />
            <YAxis yAxisId="count" tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 10 }}
              width={34}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<AnalyticsTooltip formatter={(v) => String(v)} />} />
            {/* 80 % threshold on the cumulative axis */}
            <ReferenceLine
              yAxisId="pct"
              y={80}
              stroke="#f97316"
              strokeDasharray="6 4"
              label={{
                value: '80 %',
                position: 'insideTopRight',
                fill: '#f97316',
                fontSize: 11,
                fontWeight: 700,
              }}
            />
            <Bar yAxisId="count" dataKey="count" name={t.analyticsVolumeTitle} radius={[3, 3, 0, 0]}>
              {categories.map((c, idx) => (
                <Cell
                  key={c.name}
                  fill={
                    idx <= thresholdIndex
                      ? ANALYTICS_COLORS.paretoBar
                      : 'rgba(100, 116, 139, 0.35)'
                  }
                />
              ))}
            </Bar>
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="cumulativePct"
              name={t.analyticsParetoCumulative}
              stroke={ANALYTICS_COLORS.paretoLine}
              strokeWidth={2}
              dot={{ r: 2, fill: ANALYTICS_COLORS.paretoLine }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
