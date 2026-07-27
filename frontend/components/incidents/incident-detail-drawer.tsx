'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { getIncidentById } from '@/services/incidentService';
import { IncidentDetailContent } from '@/components/incidents/incident-detail-content';
import type { IncidentDetailDTO } from '@/types/incident';

// ── Framer Motion Variants ───────────────────────

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const drawerVariants = {
  hidden: { x: '100%', opacity: 0.8 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 28, stiffness: 300 },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.25, ease: 'easeInOut' },
  },
} as const;

// ── Props ─────────────────────────────────────────

export interface IncidentDetailDrawerProps {
  /** The incident ID to load, or null to close */
  incidentId: string | null;
  /** Called when the drawer should close */
  onClose: () => void;
}

// ── Component ─────────────────────────────────────

export function IncidentDetailDrawer({
  incidentId,
  onClose,
}: IncidentDetailDrawerProps) {
  const [incident, setIncident] = useState<IncidentDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = incidentId !== null;

  // Reset and load when incidentId changes
  useEffect(() => {
    if (!incidentId) {
      setIncident(null);
      setError(null);
      return;
    }
    const safeId: string = incidentId;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getIncidentById(safeId);
        if (!cancelled) {
          setIncident(data);
        }
      } catch {
        if (!cancelled) {
          // Mock fallback
          setIncident({
            id: safeId,
            reference: 'INC-' + safeId.padStart(6, '0'),
            status: 'DECLARED',
            priority: 'MEDIUM',
            department: 'Assembly',
            station: 'Line 1 - Station 3',
            category: 'Mechanical',
            description: 'Détails de l\'incident non disponibles actuellement.',
            createdAt: new Date().toISOString(),
            declaredAt: new Date().toISOString(),
            claimedAt: null,
            inProgressAt: null,
            resolvedAt: null,
            closedAt: null,
            assignedTo: null,
            resolvedBy: null,
            resolutionNote: null,
            history: [],
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleIncidentUpdated = useCallback(
    (updated: IncidentDetailDTO) => {
      setIncident(updated);
    },
    [],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ──────────────────────────── */}
          <motion.div
            key="drawer-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
            onClick={onClose}
          />

          {/* ── Drawer Panel ──────────────────────── */}
          <motion.div
            key="incident-detail-drawer"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={[
              'fixed z-50 bg-background shadow-2xl',
              // Right-side panel spanning full viewport height
              'inset-y-0 right-0 w-full max-w-2xl border-l',
              // Flex column so body fills remaining height
              'flex flex-col',
              // Consistent right panel on all screens
              'md:w-full md:max-w-2xl',
              'lg:right-0 lg:left-auto lg:max-w-2xl lg:w-full',
            ].join(' ')}
          >
            {/* ── Header bar ───────────────────────── */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary/60" />
                <h2 className="text-sm font-semibold">
                  {incident?.reference ?? 'Incident'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── Scrollable body ──────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
              {loading && (
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Chargement de l'incident...
                    </p>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                  <h2 className="text-lg font-bold">Erreur</h2>
                  <p className="text-sm text-muted-foreground text-center">{error}</p>
                  <button
                    onClick={onClose}
                    className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    Fermer
                  </button>
                </div>
              )}

              {incident && !loading && (
                <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 md:pb-6 pt-4 md:pt-6">
                  <IncidentDetailContent
                    incident={incident}
                    onIncidentUpdated={handleIncidentUpdated}
                    compact
                  />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
