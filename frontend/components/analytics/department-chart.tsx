'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n';
import { ANALYTICS_COLORS, AnalyticsTooltip } from './chart-tooltip';
import type { DepartmentVolume } from '@/types/analytics';

interface DepartmentChartProps {
  departments: DepartmentVolume[];
}

const PALETTE = [
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#6366f1',
];

/**
 * Section 7 — Department comparison.
 * Ranked (descending) bar chart of total incident volume by department over
 * the active window.
 */
export function DepartmentChart({ departments }: DepartmentChartProps) {
  const { t } = useTranslation();

  return (
    <Card className="h-full">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-semibold">{t.analyticsDeptTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">{t.analyticsDeptDesc}</p>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={departments.length * 38 + 40}>
          <BarChart
            data={departments}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={110}
            />
            <Tooltip content={<AnalyticsTooltip formatter={(v) => String(v)} />} />
            <Bar dataKey="count" name={t.analyticsMetricTotal} radius={[0, 4, 4, 0]} barSize={20}>
              {departments.map((d, idx) => (
                <Cell key={d.name} fill={PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
