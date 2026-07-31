'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ── Props ─────────────────────────────────────────

interface EvaluationModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called to close the modal without submitting */
  onClose: () => void;
  /** Called with the evaluation payload when the user submits */
  onSubmit: (status: 'RESOLVED' | 'NON_RESOLVED', note: string) => Promise<void>;
  /** If true, shows a loading state on the submit button */
  isSubmitting?: boolean;
}

// ── Inner Modal Content ───────────────────────────

function EvaluationModalContent({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
}: EvaluationModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<'RESOLVED' | 'NON_RESOLVED'>('RESOLVED');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  async function handleSubmit() {
    // Validate: only NON_RESOLVED requires a note
    if (selectedStatus === 'NON_RESOLVED' && !note.trim()) {
      setNoteError('Une note de résolution est requise pour les incidents non résolus.');
      return;
    }

    setNoteError(null);
    await onSubmit(selectedStatus, note.trim());
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && onClose()}
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}              className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
          >
            <div
              className={cn(
                'bg-card shadow-2xl w-full',
                // Large: centered rounded card
                'max-w-lg rounded-xl border p-6',
                // Medium & below: full-bleed max-w with scrolling
                'max-sm:max-w-full max-sm:h-full max-sm:rounded-none max-sm:border-0 max-sm:overflow-y-auto max-sm:p-4',
              )}
            >
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Évaluer l'incident</h2>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status selection */}
              <div className="mb-6 space-y-3">
                <label className="text-sm font-medium text-muted-foreground">
                  Résultat de l'évaluation
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {/* RESOLVED option */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('RESOLVED')}
                    className={[
                      'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
                      selectedStatus === 'RESOLVED'
                        ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30'
                        : 'border-border hover:border-muted-foreground/30',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        selectedStatus === 'RESOLVED'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Résolu</p>
                      <p className="text-xs text-muted-foreground">
                        L'incident a été traité avec succès
                      </p>
                    </div>
                  </button>

                  {/* NON_RESOLVED option */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('NON_RESOLVED')}
                    className={[
                      'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
                      selectedStatus === 'NON_RESOLVED'
                        ? 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950/30'
                        : 'border-border hover:border-muted-foreground/30',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        selectedStatus === 'NON_RESOLVED'
                          ? 'bg-red-500 text-white'
                          : 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      <XCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Non résolu</p>
                      <p className="text-xs text-muted-foreground">
                        L'incident n'a pas pu être résolu
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Resolution note */}
              <div className="mb-6 space-y-2">
                <label
                  htmlFor="eval-note"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Note de résolution{' '}
                  {selectedStatus === 'NON_RESOLVED' && (
                    <span className="text-destructive">*</span>
                  )}
                </label>
                <textarea
                  id="eval-note"
                  rows={4}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (noteError) setNoteError(null);
                  }}
                  placeholder="Décrivez les actions prises pour résoudre l'incident..."
                  disabled={isSubmitting}
                  className={[
                    'block w-full resize-none rounded-xl border px-4 py-3 text-sm transition-colors',
                    'bg-background placeholder:text-muted-foreground/50',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30',
                    noteError
                      ? 'border-destructive focus:ring-destructive/30'
                      : 'border-input',
                    isSubmitting && 'cursor-not-allowed opacity-50',
                  ].join(' ')}
                />
                {noteError && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {noteError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/60">
                  Cette note sera enregistrée dans l'historique de l'incident.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={[
                    'gap-2',
                    selectedStatus === 'NON_RESOLVED'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700',
                  ].join(' ')}
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {selectedStatus === 'RESOLVED'
                    ? 'Confirmer la résolution'
                    : 'Confirmer non-résolution'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Portal Wrapper ────────────────────────────────

export function EvaluationModal(props: EvaluationModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <EvaluationModalContent {...props} />,
    document.body,
  );
}
