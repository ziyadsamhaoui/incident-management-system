import apiClient from '@/lib/api-client';
import type { AttachmentType, IncidentAttachment } from '@/types/attachment';

export interface UploadProgress {
  /** 0..1 */
  ratio: number;
  /** bytes transferred */
  loaded: number;
  total: number;
}

// ── Reads ───────────────────────────────────────────

/** List persisted attachments for an incident (fresh signed read URLs). */
export async function getAttachments(
  incidentId: string | number,
): Promise<IncidentAttachment[]> {
  const { data } = await apiClient.get<IncidentAttachment[]>(
    `/api/incidents/${incidentId}/attachments`,
  );
  return data;
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
      // Up to 25 Mo per video can exceed the default 15 s client timeout.
      timeout: 0,
      onUploadProgress: (e) => {
        if (e.total) {
          onProgress?.({ ratio: e.loaded / e.total, loaded: e.loaded, total: e.total });
        }
      },
    },
  );
  return data;
}
