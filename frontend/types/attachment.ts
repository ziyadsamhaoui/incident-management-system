// ── Attachment Types ────────────────────────────────
// Mirrors the backend attachment DTOs (IncidentAttachmentResponse etc.).

export type AttachmentType = 'IMAGE' | 'VIDEO' | 'AUDIO';

export interface AttachmentUserSummary {
  id: number;
  firstName: string;
  lastName: string;
  matricule: number;
}

/** Read model returned by GET /api/incidents/{id}/attachments */
export interface IncidentAttachment {
  id: number;
  incidentId: number;
  fileType: AttachmentType;
  mimeType: string;
  fileSizeBytes: number;
  fileName: string;
  /**
   * Signed read URL for rendering (<img> / <video> / <audio>) — resolved by the
   * backend's authenticated media handler. May be null while storage is degraded.
   */
  fileUrl: string | null;
  uploadedBy: AttachmentUserSummary | null;
  uploadedAt: string;
}
