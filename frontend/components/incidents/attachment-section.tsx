'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Film,
  Mic,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAttachments,
  uploadAttachment,
} from '@/services/attachmentService';
import {
  ATTACHMENT_LIMITS,
  MAX_ATTACHMENTS_PER_INCIDENT,
  compressImage,
  formatBytes,
  validateMedia,
} from '@/lib/media';
import { extractErrorMessage } from '@/lib/use-async';
import { MediaRecorderDialog } from '@/components/media/media-recorder-dialog';
import type { AttachmentType, IncidentAttachment } from '@/types/attachment';

// ── Types ───────────────────────────────────────────

interface UploadItem {
  id: string;
  fileName: string;
  fileType: AttachmentType;
  size: number;
  /** 0..1 */
  progress: number;
  status: 'uploading' | 'error';
  error?: string;
}

type RecorderMode = 'VIDEO' | 'AUDIO' | null;

// ── Sub-components ──────────────────────────────────

function AttachmentThumb({ attachment }: { attachment: IncidentAttachment }) {
  const [open, setOpen] = useState(false);

  if (!attachment.fileUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1.5">
          <ImageIcon className="h-4 w-4" />
          <span>Média indisponible</span>
        </div>
      </div>
    );
  }

  if (attachment.fileType === 'IMAGE') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative aspect-video w-full overflow-hidden rounded-lg border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.fileUrl}
            alt={attachment.fileName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        </button>
        {open && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.fileUrl}
              alt={attachment.fileName}
              className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </>
    );
  }

  if (attachment.fileType === 'VIDEO') {
    return (
      <video
        src={attachment.fileUrl}
        controls
        preload="metadata"
        className="aspect-video w-full rounded-lg border bg-black object-contain"
      />
    );
  }

  // AUDIO
  return (
    <div className="flex w-full items-center gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Mic className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.fileName}</p>
        <audio src={attachment.fileUrl} controls preload="metadata" className="mt-1 h-8 w-full" />
      </div>
    </div>
  );
}

// ── Props ───────────────────────────────────────────

export interface AttachmentSectionProps {
  incidentId: string | number;
  /** Terminal incidents (RESOLVED / NON_RESOLVED) render a read-only gallery. */
  isTerminal?: boolean;
  compact?: boolean;
}

// ── Main Component ──────────────────────────────────

export function AttachmentSection({
  incidentId,
  isTerminal = false,
  compact = false,
}: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<IncidentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [recorderMode, setRecorderMode] = useState<RecorderMode>(null);
  const [toast, setToast] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getAttachments(incidentId);
        if (!cancelled) setAttachments(data);
      } catch (err) {
        if (!cancelled) setLoadError(extractErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [incidentId]);

  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  // ── Core upload flow: compress → single multipart POST ──
  // The backend streams the payload to local disk via MultipartFile.transferTo()
  // (never into JVM heap) and verifies size/MIME/magic bytes synchronously.
  const runUpload = useCallback(
    async (file: File, fileType: AttachmentType) => {
      const validated = validateMedia(file);
      if (!validated.ok) {
        showToast(validated.reason);
        return;
      }

      let uploadFile = validated.media.file;
      if (fileType === 'IMAGE') {
        uploadFile = await compressImage(uploadFile);
      }

      const itemId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setUploads((prev) => [
        ...prev,
        {
          id: itemId,
          fileName: uploadFile.name,
          fileType,
          size: uploadFile.size,
          progress: 0,
          status: 'uploading',
        },
      ]);
      setBusy(true);

      try {
        const saved = await uploadAttachment(
          incidentId,
          uploadFile,
          fileType,
          (p) => updateUpload(itemId, { progress: p.ratio }),
        );

        setAttachments((prev) => [saved, ...prev]);
        setUploads((prev) => prev.filter((u) => u.id !== itemId));
        showToast('Pièce jointe ajoutée.');
      } catch (err) {
        updateUpload(itemId, { status: 'error', error: extractErrorMessage(err) });
      } finally {
        setBusy(false);
      }
    },
    [incidentId, showToast, updateUpload],
  );

  // ── File pickers ──
  const handleImageFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      await runUpload(file, 'IMAGE');
    },
    [runUpload],
  );

  const handleVideoFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      await runUpload(file, 'VIDEO');
    },
    [runUpload],
  );

  const canUpload =
    !isTerminal && !busy && attachments.length + uploads.length < MAX_ATTACHMENTS_PER_INCIDENT;

  const uploadCount = attachments.length + uploads.length;
  const slotLabel = `${uploadCount} / ${MAX_ATTACHMENTS_PER_INCIDENT}`;

  return (
    <Card>
      <CardHeader className={compact ? 'px-4 py-3' : undefined}>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Pièces jointes
            {!isTerminal && (
              <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {slotLabel}
              </span>
            )}
          </span>
          {isTerminal && (
            <span className="text-xs font-normal text-muted-foreground">
              Lecture seule — incident clôturé
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? 'px-4 pb-4' : undefined}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des pièces jointes...
          </div>
        ) : loadError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
        ) : (
          <>
            {/* ── Gallery ── */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {attachments.map((att) => (
                  <div key={att.id} className="space-y-1.5">
                    <AttachmentThumb attachment={att} />
                    <div className="flex items-center justify-between gap-2 px-0.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{att.fileName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(att.fileSizeBytes)}
                          {att.uploadedBy
                            ? ` · par ${att.uploadedBy.firstName} ${att.uploadedBy.lastName}`
                            : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDateTime(att.uploadedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Active uploads ── */}
            {uploads.length > 0 && (
              <div className={cn('space-y-2', attachments.length > 0 && 'mt-4')}>
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {u.fileType === 'IMAGE' ? (
                        <ImageIcon className="h-4 w-4" />
                      ) : u.fileType === 'VIDEO' ? (
                        <Film className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium">{u.fileName}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {u.status === 'error' ? 'Échec' : formatBytes(u.size)}
                        </span>
                      </div>
                      {u.status === 'error' ? (
                        <p className="mt-1 text-[11px] text-destructive">{u.error}</p>
                      ) : (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-200"
                            style={{ width: `${Math.round((u.progress || 0) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Empty state ── */}
            {attachments.length === 0 && uploads.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Paperclip className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {isTerminal
                    ? 'Aucune pièce jointe sur cet incident.'
                    : 'Ajoutez des photos, vidéos ou clips audio pour documenter l’incident.'}
                </p>
              </div>
            )}

            {/* ── Upload controls ── */}
            {canUpload && (
              <div className={cn('flex flex-wrap items-center gap-2', (attachments.length > 0 || uploads.length > 0) && 'mt-4')}>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleImageFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleVideoFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={busy}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Photo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={busy}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Film className="h-4 w-4" />
                  Vidéo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={busy}
                  onClick={() => setRecorderMode('AUDIO')}
                >
                  <Mic className="h-4 w-4" />
                  Note vocale
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── Toast ── */}
        {toast && (
          <div className="mt-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-lg">
            {toast}
          </div>
        )}
      </CardContent>

      {recorderMode && (
        <MediaRecorderDialog
          mode={recorderMode}
          onClose={() => setRecorderMode(null)}
          onRecorded={(file) => {
            setRecorderMode(null);
            void runUpload(file, recorderMode === 'VIDEO' ? 'VIDEO' : 'AUDIO');
          }}
        />
      )}
    </Card>
  );
}

