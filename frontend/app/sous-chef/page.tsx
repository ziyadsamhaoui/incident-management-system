'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  PlusCircle,
  ChevronRight,
  Clock,
  FileText,
  Wrench,
  Shield,
  MessageSquare,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { getStatusConfig } from '@/lib/constants/incidentStatus';
import { IncidentDetailDrawer } from '@/components/incidents/incident-detail-drawer';
import { WelcomeOverlay } from '@/components/auth/WelcomeOverlay';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAsync } from '@/lib/use-async';
import { getIncidents } from '@/services/incidentService';
import { getMe } from '@/services/userService';
import { useAuthStore } from '@/store/useAuthStore';
import type { IncidentDTO } from '@/types/incident';

// ── Date Helpers ──────────────────────────────────

/** Full date/time (DD/MM/YYYY HH:mm) for tooltip. */
function formatDateTimeFR(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Relative human-friendly timestamp (French). */
function relativeTime(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHours < 24) return `il y a ${diffHours} h`;
  if (diffDays === 1) return 'il y a 1 jour';
  if (diffDays < 30) return `il y a ${diffDays} jours`;
  if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`;
  return `il y a ${Math.floor(diffDays / 365)} ans`;
}

/** Check if two Date objects fall on the same calendar day. */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ── Date Bucketing ────────────────────────────────

type BucketKey = 'aujourdhui' | 'cette_semaine' | 'plus_ancien';

interface Bucket {
  key: BucketKey;
  label: string;
  incidents: IncidentDTO[];
}

function getDateBuckets(incidents: IncidentDTO[]): Bucket[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);

  const buckets: Record<BucketKey, IncidentDTO[]> = {
    aujourdhui: [],
    cette_semaine: [],
    plus_ancien: [],
  };

  for (const inc of incidents) {
    const d = new Date(inc.declaredAt);
    const incDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (isSameDay(incDate, today)) {
      buckets.aujourdhui.push(inc);
    } else if (incDate >= sevenDaysAgo) {
      buckets.cette_semaine.push(inc);
    } else {
      buckets.plus_ancien.push(inc);
    }
  }

  return (
    [
      { key: 'aujourdhui' as const, label: "Aujourd'hui", incidents: buckets.aujourdhui },
      { key: 'cette_semaine' as const, label: 'Cette semaine', incidents: buckets.cette_semaine },
      { key: 'plus_ancien' as const, label: 'Plus ancien', incidents: buckets.plus_ancien },
    ] as Bucket[]
  ).filter((b) => b.incidents.length > 0);
}

// ── Category Badge (tinted pill) ──────────────────

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Sécurité: {
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <Shield className="h-3 w-3" />,
  },
  Accident: {
    bg: 'bg-red-50 dark:bg-red-950/60',
    text: 'text-red-700 dark:text-red-300',
    icon: <Wrench className="h-3 w-3" />,
  },
  Réclamation: {
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    icon: <MessageSquare className="h-3 w-3" />,
  },
};

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    icon: <FileText className="h-3 w-3" />,
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', style.bg, style.text)}>
      {style.icon}
      {category}
    </span>
  );
}

// ── Section Sticky Header ─────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-2 border-b border-slate-200/60 dark:border-slate-800/60 mb-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}

// ── Incident Card ─────────────────────────────────

function IncidentCard({
  incident,
  onSelect,
}: {
  incident: IncidentDTO;
  onSelect: (id: string) => void;
}) {
  const config = getStatusConfig(incident.status);

  return (
    <button
      type="button"
      onClick={() => onSelect(String(incident.id))}
      className={cn(
        'w-full text-left rounded-xl border border-slate-200/80 dark:border-slate-800',
        'bg-white dark:bg-slate-900 shadow-sm',
        'border-l-4',
        config.barClass,
        'overflow-hidden p-4',
        'space-y-3',
        'transition-all duration-150',
        'active:scale-[0.98] active:bg-slate-100 dark:active:bg-slate-800',
        'hover:border-slate-300 dark:hover:border-slate-700',
        'hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'cursor-pointer select-none',
      )}
    >
      {/* Line 1: Reference + Tinted category badge | Relative timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {incident.reference}
          </span>
          <CategoryBadge category={incident.category} />
        </div>
        <span
          className="text-xs text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap"
          title={formatDateTimeFR(incident.declaredAt)}
        >
          {relativeTime(incident.declaredAt)}
        </span>
      </div>

      {/* Description excerpt */}
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 leading-relaxed">
        {incident.description}
      </p>

      {/* Line 3: Status label | High-contrast chevron */}
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', config.textClass)}>
          {config.labelFr}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300 transition-colors group-hover:text-slate-900" />
      </div>
    </button>
  );
}

// ── Feed skeleton ─────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────

export default function SousChefIncidentsPage() {
  const router = useRouter();

  // Welcome overlay — appears exactly once per login (store flag, in-memory),
  // not on every visit back to the home page.
  const welcomeSeen = useAuthStore((s) => s.welcomeSeen);
  const markWelcomeSeen = useAuthStore((s) => s.markWelcomeSeen);

  // Drawer
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);

  // Real data — current user + their declared incidents
  const { data: me } = useAsync(getMe, []);
  const { data: page, loading, error, refetch } = useAsync(
    () => (me ? getIncidents({ userId: me.id, page: 0, size: 100 }) : Promise.resolve(null)),
    [me],
  );

  const incidents = useMemo(() => page?.content ?? [], [page]);

  // Memoised date buckets
  const buckets = useMemo(() => getDateBuckets(incidents), [incidents]);

  // Derived counts
  const totalDeclared = incidents.length;
  const enCours = incidents.filter(
    (i) => i.status === 'IN_PROGRESS' || i.status === 'CLAIMED',
  ).length;

  const goToDeclare = useCallback(() => router.push('/sous-chef/incidents/declare'), [router]);

  return (
    <>
      {/* ── Welcome Overlay ── */}
      <WelcomeOverlay
        isVisible={!welcomeSeen}
        onDismiss={markWelcomeSeen}
        autoDismissMs={2600}
      />

      {/* ── Desktop width cap ── */}
      <div className="max-w-5xl mx-auto">
        {/* pb-28 on mobile clears the floating CTA; md:pb-0 resets on desktop */}
        <div className="space-y-5 pb-32 sm:pb-36 md:pb-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mes Incidents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consultez vos incidents déclarés
            </p>
          </div>

          {/* Desktop Hero CTA (hidden on mobile) */}
          <div className="hidden md:block">
            <motion.button
              type="button"
              onClick={goToDeclare}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'group relative flex w-full items-center gap-4 rounded-2xl p-6',
                'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
                'text-white shadow-lg',
                'transition-all duration-200',
                'hover:shadow-xl active:shadow-sm',
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
          </div>

          {/* Error banner */}
          {error && <ErrorState message={error} onRetry={refetch} />}

          {/* Activity summary */}
          {!loading && !error && (
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Clock className="h-4 w-4" />
              <span>
                {totalDeclared} incident{totalDeclared > 1 ? 's' : ''} déclaré
                {totalDeclared > 1 ? 's' : ''}
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{enCours} en cours</span>
            </div>
          )}

          {/* Sectioned incident feed */}
          {loading ? (
            <FeedSkeleton />
          ) : !error && totalDeclared === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Aucun incident en cours dans le système."
              description="Vous n'avez pas encore déclaré d'incident. Signalez un problème sur votre poste de travail."
              actionLabel="Déclarer un incident"
              onAction={goToDeclare}
            />
          ) : (
            <div className="space-y-6">
              {buckets.map((bucket) => (
                <div key={bucket.key} className="space-y-3">
                  <SectionHeader label={bucket.label} />
                  {bucket.incidents.map((inc) => (
                    <IncidentCard
                      key={inc.id}
                      incident={inc}
                      onSelect={(id) => setDrawerIncidentId(id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile fixed CTA — right-aligned */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <motion.button
          type="button"
          onClick={goToDeclare}
          whileTap={{ scale: 0.92 }}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl px-5 py-3',
            'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
            'text-white shadow-xl',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2',
          )}
        >
          <PlusCircle className="h-6 w-6 shrink-0" />
          <span className="font-semibold text-base whitespace-nowrap">Déclarer</span>
        </motion.button>
      </div>

      {/* Incident detail drawer */}
      <IncidentDetailDrawer
        incidentId={drawerIncidentId}
        onClose={() => setDrawerIncidentId(null)}
      />
    </>
  );
}
