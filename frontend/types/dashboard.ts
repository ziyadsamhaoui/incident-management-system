/** Response of /api/dashboard/statistics/by-status, by-priority, by-department */
export type StatMap = Record<string, number>;

export interface DashboardStats {
  byStatus: StatMap;
  byPriority: StatMap;
  byDepartment: StatMap;
}

/** Entry of GET /api/dashboard/activity (audit activity log) */
export interface ActivityLogEntry {
  id: number;
  incidentId: number | null;
  incidentReference: string | null;
  previousStatus: string | null;
  currentStatus: string | null;
  comment: string | null;
  changedAt: string | null;
}

/** Entry of GET /api/dashboard/admin-activity (heatmap) */
export interface AdminActivityEntry {
  date: string;
  count: number;
}

/** Entry of GET /api/dashboard/recent-activities (legacy feed) */
export interface RecentActivityEntry {
  id: number;
  reference: string;
  status: string;
  priority: string;
  department: string | null;
  declaredAt: string;
}
