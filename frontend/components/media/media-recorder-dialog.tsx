'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Film, Mic, Play, Square, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AUDIO_MAX_DURATION_MS,
  VIDEO_MAX_DURATION_MS,
  formatDuration,
  preferredMime,
} from '@/lib/media';

// ── MediaRecorder dialog (video / audio capture) ────

export interface MediaRecorderDialogProps {
  mode: 'VIDEO' | 'AUDIO';
  onClose: () => void;
  onRecorded: (file: File) => void;
}

export function MediaRecorderDialog({ mode, onClose, onRecorded }: MediaRecorderDialogProps) {
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

  // Preview URL for the recorded clip — allocated once per recording and
  // revoked whenever it changes or the dialog unmounts.
  const previewUrl = useMemo(
    () => (readyBlob ? URL.createObjectURL(readyBlob.blob) : null),
    [readyBlob],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

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

  // Re-acquire the mic/camera after a clip was recorded — stopStream() released
  // the tracks, so this re-arms the "Commencer" state for "Ré-enregistrer".
  const reRecord = useCallback(async () => {
    setReadyBlob(null);
    try {
      const constraints: MediaStreamConstraints = isVideo
        ? {
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          }
        : { audio: true };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      setStream(s);
      if (videoRef.current && isVideo) {
        videoRef.current.srcObject = s;
      }
      setError(null);
    } catch {
      setError(
        isVideo
          ? 'Impossible d’accéder à la caméra/micro. Vérifiez les autorisations du navigateur.'
          : 'Impossible d’accéder au micro. Vérifiez les autorisations du navigateur.',
      );
    }
  }, [isVideo]);

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
                    <video src={previewUrl ?? undefined} controls className="aspect-video w-full rounded-lg bg-black" />
                  ) : (
                    <audio src={previewUrl ?? undefined} controls className="w-full" />
                  )}
                  <Button onClick={handleSubmit} className="gap-2">
                    <UploadCloud className="h-4 w-4" />
                    Ajouter la pièce jointe
                  </Button>
                  <Button variant="outline" onClick={reRecord} className="gap-2">
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
