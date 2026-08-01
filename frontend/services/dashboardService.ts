import apiClient from '@/lib/api-client';
import type {
  DashboardStats,
  StatMap,
  ActivityLogEntry,
  AdminActivityEntry,
  RecentActivityEntry,
} from '@/types/dashboard';

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
