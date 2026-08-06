'use client';

import { AlertTriangle, HardDrive, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/services/mediaService';

interface BulkDeleteModalProps {
  open: boolean;
  count: number;
  freedBytes: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Calculated confirmation for bulk media deletion — shows the exact disk space
 * that will be reclaimed before anything is removed. Explicit admin validation
 * is mandatory (anti-pattern: never execute unconfirmed bulk deletes).
 */
export function BulkDeleteModal({
  open,
  count,
  freedBytes,
  deleting,
  onCancel,
  onConfirm,
}: BulkDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !deleting && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle>Supprimer les fichiers sélectionnés</DialogTitle>
              <DialogDescription className="pt-0.5">Action irréversible et auditée</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-foreground/90">
            Voulez-vous supprimer{' '}
            <strong className="font-semibold">
              {count} fichier{count > 1 ? 's' : ''}
            </strong>{' '}
            ? Les fichiers seront retirés du serveur et les métadonnées conservées
            sous forme de trace d'audit.
          </p>

          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
            <HardDrive className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-red-700/80 dark:text-red-300/80">
                Espace libéré
              </p>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">
                {formatFileSize(freedBytes)}
              </p>
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cette opération est définitive : le stockage est libéré immédiatement et
            les fichiers ne pourront pas être restaurés. La suppression est enregistrée
            dans la piste d'audit (fichier supprimé par [administrateur] le [date]).
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? 'Suppression en cours...' : 'Confirmer la suppression'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
