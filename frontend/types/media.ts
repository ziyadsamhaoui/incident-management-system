// ── Admin Media Management Types ───────────────────
// Mirrors the backend DTOs for /api/admin/media (AdminMediaResponse,
// AdminMediaStatsResponse, MediaBulkDeleteResult).

import type { AttachmentType, AttachmentUserSummary } from '@/types/attachment';

/** Sort tokens supported by GET /api/admin/media. */
export type MediaSort = 'newest' | 'oldest' | 'largest';

/** One media item on the admin surface — strictly IMAGE or VIDEO (no AUDIO). */
export interface AdminMediaItem {
  id: number;
  incidentId: number;
  incidentReference: string;
  departmentName: string | null;
  categoryName: string | null;
  fileType: Exclude<AttachmentType, 'AUDIO'>;
  mimeType: string;
  fileSizeBytes: number;
  fileName: string;
  /** Signed read URL for <img> / <video> — absolutized against the API origin. */
  fileUrl: string | null;
  uploadedBy: AttachmentUserSummary | null;
  uploadedAt: string;
  /**
   * Days until the retention job would auto-delete this file (terminal
   * incidents only). null = not applicable (open incident).
   */
  retentionDaysRemaining: number | null;
}

/** Storage summary strip payload (GET /api/admin/media/stats). */
export interface AdminMediaStats {
  configured: boolean;
  storagePath: string;
  storedBytes: number;
  photoBytes: number;
  videoBytes: number;
  photoCount: number;
  videoCount: number;
  totalCount: number;
  usableBytes: number;
  totalBytes: number;
}

/** Result of POST /api/admin/media/bulk-delete. */
export interface MediaBulkDeleteResult {
  deletedCount: number;
  freedBytes: number;
  skippedIds: number[];
}
