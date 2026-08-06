import apiClient, { API_BASE_URL } from '@/lib/api-client';
import type { AttachmentType, IncidentAttachment } from '@/types/attachment';

export interface UploadProgress {
  /** 0..1 */
  ratio: number;
  /** bytes transferred */
  loaded: number;
  total: number;
}

// ── Media URL helpers ───────────────────────────────

/**
 * The backend returns RELATIVE media paths ({@code /api/incidents/...}); the
 * Next.js server does not proxy {@code /api}, so browsers must request the
 * media straight from the API origin ({@code NEXT_PUBLIC_API_URL}), otherwise
 * <img>/<video>/<audio> tags hit the frontend origin and render a broken/gray
 * thumbnail.
 */
function absolutizeFileUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  return /^https?:\/\//.test(fileUrl) ? fileUrl : `${API_BASE_URL}${fileUrl}`;
}

// ── Reads ───────────────────────────────────────────

/** List persisted attachments for an incident (fresh signed read URLs). */
export async function getAttachments(
  incidentId: string | number,
): Promise<IncidentAttachment[]> {
  const { data } = await apiClient.get<IncidentAttachment[]>(
    `/api/incidents/${incidentId}/attachments`,
  );
  return data.map((att) => ({ ...att, fileUrl: absolutizeFileUrl(att.fileUrl) }));
}

// ── Multipart upload (self-hosted local pipeline) ───
// The browser streams the file straight to the Spring backend, which persists
// it to local disk via MultipartFile.transferTo() — bytes never buffer in the
// JVM heap. Images are compressed client-side before this call.

export async function uploadAttachment(
  incidentId: string | number,
  file: File,
  fileType: AttachmentType,
  onProgress?: (p: UploadProgress) => void,
): Promise<IncidentAttachment> {
  const form = new FormData();
  form.append('file', file);
  form.append('fileType', fileType);

  const { data } = await apiClient.post<IncidentAttachment>(
    `/api/incidents/${incidentId}/attachments`,
    form,
    {
      // The shared apiClient defaults to 'Content-Type: application/json', which
      // makes axios JSON.stringify() the FormData — the backend then rejects the
      // request with 415 (multipart-only endpoint). Override the header so the
      // browser sends a proper multipart/form-data body with a boundary.
      headers: { 'Content-Type': 'multipart/form-data' },
      // Up to 25 Mo per video can exceed the default 15 s client timeout.
      timeout: 0,
      onUploadProgress: (e) => {
        if (e.total) {
          onProgress?.({ ratio: e.loaded / e.total, loaded: e.loaded, total: e.total });
        }
      },
    },
  );
  return { ...data, fileUrl: absolutizeFileUrl(data.fileUrl) };
}
