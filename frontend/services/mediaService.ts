import apiClient, { API_BASE_URL } from '@/lib/api-client';
import type { Page } from '@/types/incident';
import type {
  AdminMediaItem,
  AdminMediaStats,
  MediaBulkDeleteResult,
  MediaSort,
} from '@/types/media';

// ── Query params ───────────────────────────────────

export interface AdminMediaListParams {
  /** Case-insensitive match on the incident reference. */
  search?: string;
  departmentId?: number;
  /** Strictly IMAGE or VIDEO — AUDIO is never queryable on this surface. */
  fileType?: 'IMAGE' | 'VIDEO';
  /** Inclusive lower bound (yyyy-MM-dd) on uploadedAt. */
  startDate?: string;
  /** Inclusive upper bound (yyyy-MM-dd) on uploadedAt. */
  endDate?: string;
  sort?: MediaSort;
  page?: number;
  size?: number;
}

// ── Media URL helper (same rule as attachmentService) ──

function absolutizeFileUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  return /^https?:\/\//.test(fileUrl) ? fileUrl : `${API_BASE_URL}${fileUrl}`;
}

// ── Reads ──────────────────────────────────────────

/** Paginated media inventory for the admin surface. */
export async function getAdminMedia(
  params: AdminMediaListParams = {},
): Promise<Page<AdminMediaItem>> {
  const { data } = await apiClient.get<Page<AdminMediaItem>>('/api/admin/media', {
    params: {
      page: params.page ?? 0,
      size: params.size ?? 24,
      ...(params.search ? { search: params.search } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.fileType ? { fileType: params.fileType } : {}),
      ...(params.startDate ? { startDate: params.startDate } : {}),
      ...(params.endDate ? { endDate: params.endDate } : {}),
      ...(params.sort && params.sort !== 'newest' ? { sort: params.sort } : {}),
    },
  });
  return {
    ...data,
    content: data.content.map((item) => ({ ...item, fileUrl: absolutizeFileUrl(item.fileUrl) })),
  };
}

/** Storage summary — used bytes by type + host disk headroom. */
export async function getAdminMediaStats(): Promise<AdminMediaStats> {
  const { data } = await apiClient.get<AdminMediaStats>('/api/admin/media/stats');
  return data;
}

// ── Writes (ADMIN only) ────────────────────────────

/** Delete a single file: physical disk removal + DB audit stub. */
export async function deleteMediaItem(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/media/${id}`);
}

/** Bulk delete: returns the exact freed byte count for the summary modal. */
export async function bulkDeleteMedia(ids: number[]): Promise<MediaBulkDeleteResult> {
  const { data } = await apiClient.post<MediaBulkDeleteResult>('/api/admin/media/bulk-delete', {
    ids,
  });
  return data;
}

// ── Formatting helpers ─────────────────────────────

/** "850 B" / "4.2 KB" / "3.1 MB" / "1.4 GB" — French-style space separator. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 'B';
  for (const u of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = u;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${unit}`.replace('.', ',');
}

/** Relative date-time, French locale (e.g. "05/08/2026 14:30"). */
export function formatMediaDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
