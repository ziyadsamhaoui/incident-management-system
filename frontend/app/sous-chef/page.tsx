'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, FileText, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { StatusDotLabel, getStatusConfig } from '@/lib/constants/incidentStatus';
import { IncidentDetailDrawer } from '@/components/incidents/incident-detail-drawer';

// ── Types ─────────────────────────────────────────

interface IncidentRow {
  id: number;
  reference: string;
  declaredAt: string;
  category: string;
  status: string;
}

// ── Mock data ─────────────────────────────────────

const MOCK_INCIDENTS: IncidentRow[] = [
  { id: 1, reference: 'INC-20260714-0001', declaredAt: '2026-07-14T08:23:15', category: 'Sécurité', status: 'DECLARED' },
  { id: 2, reference: 'INC-20260714-0002', declaredAt: '2026-07-14T09:15:42', category: 'Accident', status: 'CLAIMED' },
  { id: 3, reference: 'INC-20260714-0003', declaredAt: '2026-07-14T10:02:33', category: 'Réclamation', status: 'IN_PROGRESS' },
  { id: 4, reference: 'INC-20260714-0004', declaredAt: '2026-07-14T11:45:00', category: 'Sécurité', status: 'RESOLVED' },
  { id: 5, reference: 'INC-20260714-0005', declaredAt: '2026-07-14T13:10:22', category: 'Accident', status: 'CLOSED' },
  { id: 6, reference: 'INC-20260714-0006', declaredAt: '2026-07-14T14:30:00', category: 'Réclamation', status: 'NON_RESOLVED' },
];

// ── Date formatting (DD/MM/YYYY HH:mm) ────────────

function formatDateTimeFR(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ── Activity Feed Row (desktop) ──────────────────

interface FeedRowProps {
  incident: IncidentRow;
  onSelect: (id: string) => void;
}

function FeedRow({ incident, onSelect }: FeedRowProps) {
  const barClass = getStatusConfig(incident.status).barClass;

  return (
    <button
      type="button"
      onClick={() => onSelect(String(incident.id))}
      className={cn(
        'group relative flex w-full items-center gap-4 px-4 py-3.5 text-left',
        'border-l-4',
        barClass,
        'transition-all duration-150',
        'hover:bg-slate-50 dark:hover:bg-slate-800/60',
        'active:bg-slate-100 dark:active:bg-slate-800',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'border-b border-slate-100 last:border-b-0 dark:border-slate-700/40',
      )}
    >
      {/* Reference */}
      <div className="min-w-0 flex-1 sm:flex-none sm:w-48">
        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">
          {incident.reference}
        </span>
      </div>

      {/* Type — plain muted text, no pill */}
      <div className="hidden sm:block w-28 shrink-0">
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
          {incident.category}
        </span>
      </div>

      {/* Status — Dot + Text */}
      <div className="w-32 shrink-0">
        <StatusDotLabel status={incident.status} />
      </div>

      {/* Date/time — hidden on smallest screens */}
      <div className="hidden md:block w-36 shrink-0">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {formatDateTimeFR(incident.declaredAt)}
        </span>
      </div>

      {/* Chevron */}
      <div className="ml-auto shrink-0 text-slate-300 group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-400 transition-colors">
        <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
}

// ── Mobile Card (for small screens) ──────────────

function MobileCard({ incident, onSelect }: FeedRowProps) {
  const barClass = getStatusConfig(incident.status).barClass;

  return (
    <button
      type="button"
      onClick={() => onSelect(String(incident.id))}
      className={cn(
        'w-full text-left rounded-xl border border-slate-200/80 bg-white p-4',
        'dark:border-slate-700/60 dark:bg-slate-800/80',
        'border-l-4',
        barClass,
        'transition-all duration-150 active:scale-[0.98]',
        'hover:border-slate-300 dark:hover:border-slate-600',
        'hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'space-y-2',
      )}
    >
      {/* Row 1: Reference + Status */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
          {incident.reference}
        </span>
        <StatusDotLabel status={incident.status} />
      </div>

      {/* Row 2: Type (plain text) + Date */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
          {incident.category}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatDateTimeFR(incident.declaredAt)}
        </span>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────

export default function SousChefIncidentsPage() {
  const { firstName, lastName } = useAuthStore();

  // Welcome overlay state
  const [showWelcome, setShowWelcome] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  // Drawer state
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);

  // Derived activity summary
  const totalDeclared = MOCK_INCIDENTS.length;
  const enCours = MOCK_INCIDENTS.filter(
    (i) => i.status === 'IN_PROGRESS' || i.status === 'CLAIMED',
  ).length;

  const displayName =
    lastName && firstName ? `${lastName} ${firstName}` : firstName ?? 'Utilisateur';

  return (
    <div className="space-y-5">
      {/* ── Welcome Overlay ────────────────────────── */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            key="welcome-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-center"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Bienvenue,{' '}
                <span className="text-primary">{displayName}</span>
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Header ──────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes Incidents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultez vos incidents déclarés
        </p>
      </div>

      {/* ── Hero CTA: Déclarer un incident ──────────── */}
      <motion.button
        type="button"
        onClick={() => {
          // TODO: Navigate to incident declaration form
          console.log('Déclarer un incident');
        }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'group relative flex w-full items-center gap-4 rounded-2xl p-6',
          'bg-blue-600 hover:bg-blue-700',
          'text-white shadow-md',
          'transition-all duration-200',
          'hover:shadow-lg active:shadow-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2',
          'min-h-[72px]',
        )}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <PlusCircle className="h-7 w-7 text-white" />
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-lg font-bold leading-tight tracking-tight">
            Déclarer un incident
          </span>
          <span className="text-sm text-blue-100/80">
            Signaler un problème sur votre poste de travail
          </span>
        </div>
        <div className="ml-auto shrink-0 text-white/40 group-hover:text-white/60 transition-colors">
          <ChevronRight className="h-6 w-6" />
        </div>
      </motion.button>

      {/* ── Activity Summary ──────────────────────────── */}
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
        <Clock className="h-4 w-4" />
        <span>
          {totalDeclared} incident{totalDeclared > 1 ? 's' : ''} déclaré
          {totalDeclared > 1 ? 's' : ''}
        </span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span>{enCours} en cours</span>
      </div>

      {/* ── Activity Feed ──────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800/90 overflow-hidden">
        {/* Desktop header row */}
        <div className="hidden sm:flex items-center gap-4 border-b border-slate-200/80 bg-slate-50/80 px-4 py-2.5 dark:border-slate-700/60 dark:bg-slate-800/50">
          <span className="w-48 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Référence</span>
          <span className="w-28 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</span>
          <span className="w-32 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Statut</span>
          <span className="w-36 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date / Heure</span>
          <span className="sr-only">Voir</span>
        </div>

        {/* Desktop rows */}
        <div className="hidden sm:block divide-y divide-slate-100 dark:divide-slate-700/40">
          {MOCK_INCIDENTS.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/50">
                <FileText className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aucun incident déclaré</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Utilisez le bouton ci-dessus pour déclarer votre premier incident.</p>
            </div>
          ) : (
            MOCK_INCIDENTS.map((inc) => (
              <FeedRow key={inc.id} incident={inc} onSelect={(id) => setDrawerIncidentId(id)} />
            ))
          )}
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-2 p-3">
          {MOCK_INCIDENTS.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/50">
                <FileText className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aucun incident déclaré</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Utilisez le bouton ci-dessus pour déclarer votre premier incident.</p>
            </div>
          ) : (
            MOCK_INCIDENTS.map((inc) => (
              <MobileCard key={inc.id} incident={inc} onSelect={(id) => setDrawerIncidentId(id)} />
            ))
          )}
        </div>
      </div>

      {/* ── Incident Detail Drawer ─────────────────── */}
      <IncidentDetailDrawer
        incidentId={drawerIncidentId}
        onClose={() => setDrawerIncidentId(null)}
      />
    </div>
  );
}
