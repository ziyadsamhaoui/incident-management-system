'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

// ── Props ─────────────────────────────────────────

export interface WelcomeOverlayProps {
  /** Whether the overlay is currently visible */
  isVisible: boolean;
  /** Called when the overlay finishes its auto-dismiss timeout */
  onDismiss: () => void;
  /** Auto-dismiss delay in milliseconds (default: 2500) */
  autoDismissMs?: number;
}

// ── Component ─────────────────────────────────────

export function WelcomeOverlay({
  isVisible,
  onDismiss,
  autoDismissMs = 2500,
}: WelcomeOverlayProps) {
  const { firstName, lastName } = useAuthStore();

  // Auto-dismiss timer
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [isVisible, onDismiss, autoDismissMs]);

  const displayName =
    lastName && firstName
      ? `${firstName} ${lastName}`
      : firstName ?? 'Utilisateur';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="welcome-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            key="welcome-card"
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center border border-gray-100 dark:border-slate-800"
          >
            {/* ── Top Icon Avatar Pill ───────────── */}
            <div className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 p-3 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-4">
              <UserCheck className="h-6 w-6" />
            </div>

            {/* ── Title ──────────────────────────── */}
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              Bienvenue,{' '}
              <span className="text-primary">{displayName}</span>
            </h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
