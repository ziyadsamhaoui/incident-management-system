import apiClient from '@/lib/api-client';
import type {
  DashboardStats,
  StatMap,
  ActivityLogEntry,
  AdminActivityEntry,
  ContributionEntry,
  RecentActivityEntry,
} from '@/types/dashboard';
import type { Page } from '@/types/incident';

/** Dashboard statistics — grouped by status, priority and department. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [byStatus, byPriority, byDepartment] = await Promise.all([
    apiClient.get<StatMap>('/api/dashboard/statistics/by-status'),
    apiClient.get<StatMap>('/api/dashboard/statistics/by-priority'),
    apiClient.get<StatMap>('/api/dashboard/statistics/by-department'),
  ]);
  return {
    byStatus: byStatus.data,
    byPriority: byPriority.data,
    byDepartment: byDepartment.data,
  };
}

/** Audit activity log — chronological status transitions (real data). */
export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  const { data } = await apiClient.get<ActivityLogEntry[]>('/api/dashboard/activity');
  return data;
}

/** Legacy recent-activities feed. */
export async function getRecentActivities(): Promise<RecentActivityEntry[]> {
  const { data } = await apiClient.get<RecentActivityEntry[]>('/api/dashboard/recent-activities');
  return data;
}

/** Admin evaluation heatmap — evaluations per day over the last 12 months. */
export async function getAdminActivity(): Promise<AdminActivityEntry[]> {
  const { data } = await apiClient.get<AdminActivityEntry[]>('/api/dashboard/admin-activity');
  return data;
}

/** Personal contribution history — declarations, claims, and evaluations for the current user. */
export async function getMyContributions(params: {
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
} = {}): Promise<Page<ContributionEntry>> {
  const { data } = await apiClient.get<Page<ContributionEntry>>('/api/me/contributions', {
    params: {
      ...(params.startDate ? { startDate: params.startDate } : {}),
      ...(params.endDate ? { endDate: params.endDate } : {}),
      page: params.page ?? 0,
      size: params.size ?? 50,
    },
  });
  return data;
}
