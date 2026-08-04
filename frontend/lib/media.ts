'use client';

import imageCompression from 'browser-image-compression';
import type { AttachmentType } from '@/types/attachment';

// ── Hard limits (must mirror backend IncidentAttachmentService) ──

export const ATTACHMENT_LIMITS: Record<AttachmentType, { maxBytes: number; label: string }> = {
  IMAGE: { maxBytes: 5 * 1024 * 1024, label: '5 Mo' },
  VIDEO: { maxBytes: 25 * 1024 * 1024, label: '25 Mo' },
  AUDIO: { maxBytes: 5 * 1024 * 1024, label: '5 Mo' },
};

export const MAX_ATTACHMENTS_PER_INCIDENT = 5;

// ── Image compression (photos) ──────────────────────
// Resize to a maximum of 1280px on the long edge, re-encode as JPEG at
// 70–80% quality. Reduces upload payload for spotty factory Wi-Fi without
// degrading diagnostic clarity.

const COMPRESSION_OPTIONS = {
  maxSizeMB: 4, // safety net — the true cap is the 5 Mo backend limit
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  initialQuality: 0.75,
  fileType: 'image/jpeg',
};

export async function compressImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, COMPRESSION_OPTIONS);
  } catch {
    // Compression failure (exotic format / worker issue) → upload original.
    return file;
  }
}

// ── Validation ───────────────────────────────────────

export interface ValidatedMedia {
  file: File;
  fileType: AttachmentType;
}

function detectType(mime: string, name: string): AttachmentType | null {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  // Fall back on the extension when the MIME is generic (e.g. .webm).
  const lower = name.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif|avif)$/.test(lower)) return 'IMAGE';
  if (/\.(mp4|webm|mov|avi|m4v)$/.test(lower)) return 'VIDEO';
  if (/\.(webm|ogg|mp3|m4a|wav|aac|oga)$/.test(lower)) return 'AUDIO';
  return null;
}

/** Returns a human-readable reason when the file must be rejected. */
export function validateMedia(file: File): { ok: true; media: ValidatedMedia } | { ok: false; reason: string } {
  const type = detectType(file.type || '', file.name);
  if (!type) {
    return { ok: false, reason: 'Type de fichier non supporté (photo, vidéo ou audio uniquement).' };
  }
  const { maxBytes, label } = ATTACHMENT_LIMITS[type];
  if (file.size > maxBytes) {
    return {
      ok: false,
      reason: `Fichier trop volumineux — limite ${label} pour ${type === 'IMAGE' ? 'les photos' : type === 'VIDEO' ? 'les vidéos' : 'les clips audio'}.`,
    };
  }
  return { ok: true, media: { file, fileType: type } };
}

// ── MediaRecorder capture helpers ────────────────────
// Bounded in-browser capture: video ≤ 30 s @ 720p, audio ≤ 60 s.

export const VIDEO_MAX_DURATION_MS = 30_000;
export const AUDIO_MAX_DURATION_MS = 60_000;

export function preferredMime(mimeCandidates: string[]): string {
  for (const mime of mimeCandidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // ignore
    }
  }
  return '';
}

// ── Formatting ───────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
