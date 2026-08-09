import apiClient from '@/lib/api-client';
import type {
  HeatmapResponse,
  ParetoResponse,
  RepeatSignalResponse,
  VolumeSpeedResponse,
  WorkloadEntry,
} from '@/types/analytics';

/** Shared analytics query parameters — the global control bar of /analytics. */
export interface AnalyticsQueryParams {
  /** ISO date (yyyy-MM-dd). */
  startDate: string;
  /** ISO date (yyyy-MM-dd), inclusive. */
  endDate: string;
  /** Optional department filter. */
  departmentId?: number;
}

/** Time-bucketed volume, resolution quality, MTTR, time-to-claim + deltas. */
export async function getVolumeSpeed(
  params: AnalyticsQueryParams,
  compare: boolean,
): Promise<VolumeSpeedResponse> {
  const { data } = await apiClient.get<VolumeSpeedResponse>('/api/analytics/volume-speed', {
    params: { ...params, compare },
  });
  return data;
}

/** Category Pareto (80/20) analysis — server-side cumulative percentages. */
export async function getPareto(params: AnalyticsQueryParams): Promise<ParetoResponse> {
  const { data } = await apiClient.get<ParetoResponse>('/api/analytics/pareto', { params });
  return data;
}

/** Hour-of-day × day-of-week shift heatmap. */
export async function getHeatmap(params: AnalyticsQueryParams): Promise<HeatmapResponse> {
  const { data } = await apiClient.get<HeatmapResponse>('/api/analytics/heatmap', { params });
  return data;
}

/** Rule-based repeat-incident signals. */
export async function getRepeatSignals(params: AnalyticsQueryParams): Promise<RepeatSignalResponse> {
  const { data } = await apiClient.get<RepeatSignalResponse>('/api/analytics/repeat-signals', { params });
  return data;
}

/** ADMIN-scoped team workload distribution. */
export async function getWorkload(params: AnalyticsQueryParams): Promise<WorkloadEntry[]> {
  const { data } = await apiClient.get<WorkloadEntry[]>('/api/analytics/workload', { params });
  return data;
}
