'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getIncidentDetail } from '@/services/incidentService';
import { extractErrorMessage } from '@/lib/use-async';
import { IncidentDetailContent } from '@/components/incidents/incident-detail-content';
import type { IncidentDetailDTO, IncidentDTO } from '@/types/incident';

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
  // SSR safety — only render portal on the client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [incident, setIncident] = useState<IncidentDTO | IncidentDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

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
        const data = await getIncidentDetail(safeId);
        if (!cancelled) {
          setIncident(data);
        }
      } catch (err) {
        if (!cancelled) {
          setIncident(null);
          setError(extractErrorMessage(err));
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
  }, [incidentId, reloadTick]);

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
    (updated: IncidentDTO | IncidentDetailDTO) => {
      // Keep the already-loaded audit history visible after an inline action
      // (mutation responses return a plain IncidentDTO without history).
      setIncident((prev) => ({
        ...updated,
        history: prev && 'history' in prev ? prev.history : [],
      }));
    },
    [],
  );

  const drawerContent = (
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
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm dark:bg-black/70"
            onClick={onClose}
          />

          {/* ── Drawer Panel ──────────────────────── */}
          <motion.div
            key="incident-detail-drawer"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-y-0 right-0 z-[9999] w-full max-w-2xl bg-background text-foreground shadow-2xl h-screen overflow-y-auto"
          >
            {/* ── Header bar — flush to top edge, no top offsets ─ */}
            <div className="flex h-14 items-center justify-between border-b px-4">
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

            {/* ── Body — no top offsets anywhere ──── */}
            {loading && (
              <div className="flex items-center justify-center p-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Chargement de l'incident...
                  </p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center gap-4 p-12">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <h2 className="text-lg font-bold">Erreur</h2>
                <p className="text-sm text-muted-foreground text-center">
                  {error}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setError(null);
                      setIncident(null);
                      // Re-run the load effect
                      setReloadTick((t) => t + 1);
                    }}
                    className="gap-1.5"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Réessayer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onClose}
                    className="text-muted-foreground"
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            )}

            {incident && !loading && (
              <div className="p-6">
                <IncidentDetailContent
                  incident={incident}
                  onIncidentUpdated={handleIncidentUpdated}
                  compact
                />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Portal to document.body to escape parent layout stacking context
  if (!mounted) return null;
  return createPortal(drawerContent, document.body);
}
