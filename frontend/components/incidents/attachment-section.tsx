'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Film,
  Mic,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Play,
  Square,
  UploadCloud,
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
  AUDIO_MAX_DURATION_MS,
  MAX_ATTACHMENTS_PER_INCIDENT,
  VIDEO_MAX_DURATION_MS,
  compressImage,
  formatBytes,
  formatDuration,
  preferredMime,
  validateMedia,
} from '@/lib/media';
import { extractErrorMessage } from '@/lib/use-async';
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

// ── MediaRecorder dialog (video / audio capture) ────

interface MediaRecorderDialogProps {
  mode: 'VIDEO' | 'AUDIO';
  onClose: () => void;
  onRecorded: (file: File) => void;
}

function MediaRecorderDialog({ mode, onClose, onRecorded }: MediaRecorderDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [readyBlob, setReadyBlob] = useState<{ blob: Blob; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxDuration = mode === 'VIDEO' ? VIDEO_MAX_DURATION_MS : AUDIO_MAX_DURATION_MS;
  const isVideo = mode === 'VIDEO';

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start the camera/mic on mount; the cleanup always stops the tracks (via a
  // ref, so it works even when the component unmounts without handleCancel).
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const constraints: MediaStreamConstraints = isVideo
          ? {
              video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: true,
            }
          : { audio: true };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        setStream(s);
        if (videoRef.current && isVideo) {
          videoRef.current.srcObject = s;
        }
      } catch {
        setError(
          isVideo
            ? 'Impossible d’accéder à la caméra/micro. Vérifiez les autorisations du navigateur.'
            : 'Impossible d’accéder au micro. Vérifiez les autorisations du navigateur.',
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = () => {
    if (!stream) return;
    const mime = isVideo
      ? preferredMime(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
      : preferredMime(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']);
    try {
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || (isVideo ? 'video/webm' : 'audio/webm') });
        setReadyBlob({ blob, mime: mime || (isVideo ? 'video/webm' : 'audio/webm') });
        stopStream();
      };
      recorderRef.current = recorder;
      recorder.start();
      startRef.current = Date.now();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const ell = now - startRef.current;
        if (ell >= maxDuration) {
          recorder.stop();
          setElapsed(maxDuration);
        } else {
          setElapsed(ell);
        }
      }, 250);
    } catch {
      setError('Ce navigateur ne supporte pas l’enregistrement. Utilisez l’import depuis le téléphone.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleSubmit = () => {
    if (!readyBlob) return;
    const ext = isVideo ? 'webm' : readyBlob.mime.includes('mp4') ? 'm4a' : 'webm';
    const name = isVideo ? `video-${Date.now()}.${ext}` : `audio-${Date.now()}.${ext}`;
    const file = new File([readyBlob.blob], name, { type: readyBlob.mime });
    onRecorded(file);
  };

  const handleCancel = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    stopStream();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {isVideo ? <Film className="h-4 w-4 text-primary" /> : <Mic className="h-4 w-4 text-primary" />}
            {isVideo ? 'Enregistrer une vidéo' : 'Enregistrer une note vocale'}
          </h3>
          <button
            type="button"
            onClick={handleCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : (
            <>
              {isVideo ? (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                  {recording && (
                    <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      REC {formatDuration(elapsed)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 py-8">
                  <div
                    className={cn(
                      'flex h-16 w-16 items-center justify-center rounded-full transition-all',
                      recording
                        ? 'animate-pulse bg-red-100 text-red-600'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    <Mic className="h-7 w-7" />
                  </div>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    {recording ? formatDuration(elapsed) : '00:00'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Durée max {isVideo ? '30 s' : '60 s'}
                  </p>
                </div>
              )}

              {readyBlob ? (
                <div className="flex flex-col gap-2">
                  {isVideo ? (
                    <video src={URL.createObjectURL(readyBlob.blob)} controls className="aspect-video w-full rounded-lg bg-black" />
                  ) : (
                    <audio src={URL.createObjectURL(readyBlob.blob)} controls className="w-full" />
                  )}
                  <Button onClick={handleSubmit} className="gap-2">
                    <UploadCloud className="h-4 w-4" />
                    Ajouter la pièce jointe
                  </Button>
                  <Button variant="outline" onClick={startRecording} className="gap-2">
                    <Camera className="h-4 w-4" />
                    Ré-enregistrer
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  {!recording ? (
                    <Button onClick={startRecording} className="gap-2">
                      <Play className="h-4 w-4" />
                      {isVideo ? 'Commencer l’enregistrement' : 'Commencer'}
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={stopRecording} className="gap-2">
                      <Square className="h-4 w-4" />
                      Arrêter
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
