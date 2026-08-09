'use client';

import { useMemo, useState } from 'react';
import { LineChart, Inbox } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';
import { useAuthStore } from '@/store/useAuthStore';
import { getDepartments } from '@/services/referenceService';
import {
  getHeatmap,
  getPareto,
  getRepeatSignals,
  getVolumeSpeed,
  getWorkload,
} from '@/services/analyticsService';
import type { AnalyticsReportData } from '@/lib/report';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ChartBlockSkeleton, StatGridSkeleton } from '@/components/ui/skeleton';
import { AnalyticsControls, type RangePreset } from '@/components/analytics/analytics-controls';
import { SummaryStrip } from '@/components/analytics/summary-strip';
import { VolumeCharts } from '@/components/analytics/volume-charts';
import { SpeedCharts } from '@/components/analytics/speed-charts';
import { ParetoChart } from '@/components/analytics/pareto-chart';
import { ShiftHeatmap } from '@/components/analytics/shift-heatmap';
import { RepeatSignalsList } from '@/components/analytics/repeat-signals-list';
import { DepartmentChart } from '@/components/analytics/department-chart';
import { WorkloadTable } from '@/components/analytics/workload-table';
import { ExportDropdown } from '@/components/analytics/export-dropdown';
import { fullDate } from '@/components/analytics/chart-tooltip';

// ── Date helpers ──────────────────────────────────

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function presetRange(preset: RangePreset, customFrom: string, customTo: string): { startDate: string; endDate: string } {
  const to = new Date();
  const from = new Date();
  if (preset === 'custom') {
    return {
      startDate: customFrom || iso(new Date(Date.now() - 29 * 86400000)),
      endDate: customTo || iso(to),
    };
  }
  switch (preset) {
    case '7':
      from.setDate(to.getDate() - 6);
      break;
    case '30':
      from.setDate(to.getDate() - 29);
      break;
    case '90':
      from.setDate(to.getDate() - 89);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      break;
    default:
      break;
  }
  return { startDate: iso(from), endDate: iso(to) };
}

// ── Page ──────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.some((r) => r === 'ROLE_ADMIN');

  const [preset, setPreset] = useState<RangePreset>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [compare, setCompare] = useState(false);

  const deptsFetch = useAsync(() => getDepartments(), []);
  const departmentOptions = (deptsFetch.data ?? []).map((d) => ({
    value: String(d.id),
    label: d.name,
  }));
  const departmentLabel =
    departmentId !== ''
      ? (departmentOptions.find((d) => d.value === String(departmentId))?.label ?? '')
      : t.analyticsAllDepartments;

  const { startDate, endDate } = useMemo(
    () => presetRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const params = useMemo(
    () => ({ startDate, endDate, departmentId: departmentId === '' ? undefined : departmentId }),
    [startDate, endDate, departmentId],
  );

  // ── Data fetches (all server-side aggregated) ───
  const volumeFetch = useAsync(
    () => getVolumeSpeed(params, compare),
    [params.startDate, params.endDate, params.departmentId, compare],
  );
  const paretoFetch = useAsync(() => getPareto(params), [params.startDate, params.endDate, params.departmentId]);
  const heatmapFetch = useAsync(() => getHeatmap(params), [params.startDate, params.endDate, params.departmentId]);
  const signalsFetch = useAsync(() => getRepeatSignals(params), [params.startDate, params.endDate, params.departmentId]);
  const workloadFetch = useAsync(
    () => (isAdmin ? getWorkload(params) : Promise.resolve([])),
    [params.startDate, params.endDate, params.departmentId, isAdmin],
  );

  const loading = volumeFetch.loading || paretoFetch.loading || heatmapFetch.loading || signalsFetch.loading;
  const error = volumeFetch.error ?? paretoFetch.error ?? heatmapFetch.error ?? signalsFetch.error;
  const retryAll = () => {
    volumeFetch.refetch();
    paretoFetch.refetch();
    heatmapFetch.refetch();
    signalsFetch.refetch();
    workloadFetch.refetch();
  };

  // ── Report bundle for the export engine ─────────
  const report: AnalyticsReportData | null = useMemo(() => {
    if (!volumeFetch.data || !paretoFetch.data || !heatmapFetch.data || !signalsFetch.data) {
      return null;
    }
    return {
      rangeLabel: `${fullDate(startDate)} – ${fullDate(endDate)}`,
      departmentLabel,
      compare,
      totals: volumeFetch.data.totals,
      deltas: volumeFetch.data.deltas,
      buckets: volumeFetch.data.buckets,
      pareto: paretoFetch.data,
      departments: volumeFetch.data.departments,
      signals: signalsFetch.data.signals,
      workload: workloadFetch.data,
    };
  }, [volumeFetch.data, paretoFetch.data, heatmapFetch.data, signalsFetch.data, workloadFetch.data,
      startDate, endDate, departmentLabel, compare]);

  const hasData = volumeFetch.data != null && volumeFetch.data.totals.reported > 0;

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* ── Page header ───────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LineChart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            {t.analyticsTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.analyticsSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ExportDropdown report={report} />
        </div>
      </div>

      {/* ── Global control bar ────────────────────── */}
      <AnalyticsControls
        preset={preset}
        onPresetChange={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomChange={(f, to) => {
          setCustomFrom(f);
          setCustomTo(to);
        }}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        departmentOptions={departmentOptions}
        compare={compare}
        onCompareChange={setCompare}
      />

      {/* ── Page-level error banner ───────────────── */}
      {error && <ErrorState message={`${t.analyticsError} — ${error}`} onRetry={retryAll} />}

      {/* ── Summary strip (with deltas) ───────────── */}
      {volumeFetch.loading ? (
        <StatGridSkeleton count={4} />
      ) : volumeFetch.data ? (
        <SummaryStrip totals={volumeFetch.data.totals} deltas={volumeFetch.data.deltas} compare={compare} />
      ) : null}

      {/* ── System-zero state ─────────────────────── */}
      {!loading && !error && !hasData && (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={Inbox} title={t.analyticsEmpty} />
        </div>
      )}

      {/* ── Widgets ───────────────────────────────── */}
      {!error && hasData && (
        <>
          {/* Volume & resolution quality trends */}
          {volumeFetch.loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartBlockSkeleton height={210} />
              <ChartBlockSkeleton height={210} />
            </div>
          ) : (
            <VolumeCharts buckets={volumeFetch.data?.buckets ?? []} />
          )}

          {/* Speed & responsiveness trends */}
          {volumeFetch.loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartBlockSkeleton height={200} />
              <ChartBlockSkeleton height={200} />
            </div>
          ) : (
            <SpeedCharts buckets={volumeFetch.data?.buckets ?? []} />
          )}

          {/* Industrial Pareto 80/20 */}
          {paretoFetch.loading ? (
            <ChartBlockSkeleton height={280} />
          ) : paretoFetch.data ? (
            <ParetoChart pareto={paretoFetch.data} />
          ) : null}

          {/* Shift heatmap + repeat signals */}
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {heatmapFetch.loading ? (
                <ChartBlockSkeleton height={260} />
              ) : heatmapFetch.data ? (
                <ShiftHeatmap heatmap={heatmapFetch.data} />
              ) : null}
            </div>
            <div className="lg:col-span-2">
              <RepeatSignalsList
                signals={signalsFetch.data?.signals ?? []}
                loading={signalsFetch.loading}
                error={signalsFetch.error}
                onRetry={signalsFetch.refetch}
              />
            </div>
          </div>

          {/* Department comparison + admin workload */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Hidden when a department filter is active — a single-department
                ranking would be meaningless (backend returns an empty list). */}
            {(volumeFetch.data?.departments.length ?? 0) > 0 && (
              <DepartmentChart departments={volumeFetch.data?.departments ?? []} />
            )}
            {isAdmin && (
              <div className={(volumeFetch.data?.departments.length ?? 0) > 0 ? '' : 'lg:col-span-2'}>
                <WorkloadTable
                  entries={workloadFetch.data ?? []}
                  loading={workloadFetch.loading}
                  error={workloadFetch.error}
                  onRetry={workloadFetch.refetch}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
