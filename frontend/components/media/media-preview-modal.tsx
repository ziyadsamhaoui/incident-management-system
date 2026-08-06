'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Trash2,
  Loader2,
  ZoomIn,
  ZoomOut,
  Clock,
  Image as ImageIcon,
  Film,
  User,
  Building2,
  FolderTree,
  CalendarDays,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatFileSize, formatMediaDate } from '@/services/mediaService';
import type { AdminMediaItem } from '@/types/media';

interface MediaPreviewModalProps {
  item: AdminMediaItem;
  deleting: boolean;
  onClose: () => void;
  onConfirmDelete: (item: AdminMediaItem) => void;
}

/**
 * Media inspector modal for /admin/media. The parent must remount it with
 * {@code <MediaPreviewModal key={item.id} … />} so per-item state (zoom,
 * confirmation, media specs) resets on open.
 */
export function MediaPreviewModal({ item, deleting, onClose, onConfirmDelete }: MediaPreviewModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const isImage = item.fileType === 'IMAGE';

  // Technical spec read from the media element once loaded (not stored in DB).
  const specs = useMemo(() => {
    if (isImage && imageDims) {
      return { label: 'Dimensions', value: `${imageDims.w} × ${imageDims.h} px` };
    }
    if (!isImage && videoDuration != null && Number.isFinite(videoDuration)) {
      const s = Math.round(videoDuration);
      const m = Math.floor(s / 60);
      return { label: 'Durée', value: m > 0 ? `${m} min ${s % 60} s` : `${s} s` };
    }
    return null;
  }, [isImage, imageDims, videoDuration]);

  const handleClose = () => {
    setConfirming(false);
    setZoomed(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && handleClose()}>
      {/* hideCloseButton: this modal renders its own (bigger) header close button. */}
      <DialogContent hideCloseButton className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              {isImage ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
              ) : (
                <Film className="h-4 w-4 shrink-0 text-indigo-500" />
              )}
              <span className="truncate font-mono">{item.fileName}</span>
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 pt-1 text-xs">
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                {item.incidentReference}
              </span>
              {item.departmentName && (
                <>
                  <span aria-hidden>·</span>
                  <span>{item.departmentName}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-9rem)] overflow-y-auto md:grid-cols-[1.6fr_1fr]">
          {/* ── Preview ── */}
          <div className="flex min-h-64 items-center justify-center bg-slate-100 p-4 dark:bg-slate-900/60">
            {item.fileUrl ? (
              isImage ? (
                <div className="max-w-full overflow-auto">
                  <img
                    src={item.fileUrl}
                    alt={item.fileName}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      setImageDims({ w: el.naturalWidth, h: el.naturalHeight });
                    }}
                    className={cn(
                      'max-h-96 rounded-lg object-contain transition-transform duration-200',
                      zoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in',
                    )}
                    onClick={() => setZoomed((z) => !z)}
                  />
                </div>
              ) : (
                <video
                  src={item.fileUrl}
                  controls
                  preload="metadata"
                  onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                  className="max-h-96 w-full rounded-lg bg-black"
                />
              )
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-8 w-8" />
                <p className="text-sm">Fichier indisponible (stockage dégradé ou déjà supprimé).</p>
              </div>
            )}
          </div>

          {/* ── Metadata panel ── */}
          <div className="flex flex-col border-t md:border-l md:border-t-0">
            <div className="space-y-3.5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Détails du fichier
              </p>

              <MetaRow label="Incident">
                <Link
                  href={`/admin/incidents/${item.incidentId}`}
                  className="font-mono text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {item.incidentReference}
                </Link>
              </MetaRow>

              <MetaRow icon={User} label="Ajouté par">
                <span className="text-xs">
                  {item.uploadedBy
                    ? `${item.uploadedBy.firstName} ${item.uploadedBy.lastName}`
                    : '—'}
                </span>
              </MetaRow>

              <MetaRow icon={Building2} label="Département">
                <span className="text-xs">{item.departmentName ?? '—'}</span>
              </MetaRow>

              <MetaRow icon={FolderTree} label="Catégorie">
                <span className="text-xs">{item.categoryName ?? '—'}</span>
              </MetaRow>

              <MetaRow icon={HardDrive} label="Taille">
                <span className="text-xs font-semibold">{formatFileSize(item.fileSizeBytes)}</span>
              </MetaRow>

              {specs && (
                <MetaRow icon={isImage ? ImageIcon : Film} label={specs.label}>
                  <span className="text-xs">{specs.value}</span>
                </MetaRow>
              )}

              <MetaRow icon={CalendarDays} label="Téléversé le">
                <span className="text-xs">{formatMediaDate(item.uploadedAt)}</span>
              </MetaRow>

              {/* Retention countdown */}
              <div>
                {item.retentionDaysRemaining != null ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                      item.retentionDaysRemaining <= 7
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : item.retentionDaysRemaining <= 30
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {item.retentionDaysRemaining === 0
                      ? 'Suppression automatique aujourd\u2019hui'
                      : `Suppression automatique dans ${item.retentionDaysRemaining} jour${item.retentionDaysRemaining > 1 ? 's' : ''}`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Conservé : incident en cours
                  </span>
                )}
              </div>
            </div>

            {/* ── Delete zone ── */}
            <div className="mt-auto border-t bg-muted/30 p-4">
              {confirming ? (
                <div className="space-y-3">
                  <p className="flex items-start gap-2 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Supprimer définitivement ce fichier du serveur ? La trace d'audit sera
                    conservée, mais le fichier ne pourra plus être restauré.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirming(false)}
                      disabled={deleting}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-1.5"
                      onClick={() => onConfirmDelete(item)}
                      disabled={deleting}
                    >
                      {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirmer la suppression
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isImage && item.fileUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setZoomed((z) => !z)}
                    >
                      {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
                      {zoomed ? 'Réduire' : 'Zoomer'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="ml-auto gap-1.5"
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer le fichier
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-foreground/90">{children}</span>
    </div>
  );
}
