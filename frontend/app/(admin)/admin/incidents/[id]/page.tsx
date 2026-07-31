'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Clock,
  ShieldAlert,
  Wrench,
  MessageSquare,
  Zap,
  Settings,
  UserCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getStatusConfig } from '@/lib/constants/incidentStatus';
import { EvaluationModal } from '@/components/incidents/evaluation-modal';
import type { IncidentDetailDTO, IncidentHistoryEntry } from '@/types/incident';

// ── Category Icon Map ─────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Sécurité: ShieldAlert,
  Accident: Wrench,
  Réclamation: MessageSquare,
  Mécanique: Zap,
  Électrique: Settings,
};

function getCategoryIcon(cat: string): React.ElementType {
  return CATEGORY_ICONS[cat] ?? AlertTriangle;
}

// ── Priority Config ───────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Élevée',
  CRITICAL: 'Critique',
};

const PRIORITY_CLASSES: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ── Mock Data ─────────────────────────────────────

const MOCK_INCIDENT: IncidentDetailDTO = {
  id: '1',
  reference: 'INC-20260730-0001',
  status: 'IN_PROGRESS',
  priority: 'CRITICAL',
  department: 'Assemblage',
  station: 'ASM-L1-S3',
  category: 'Sécurité',
  description:
    'Détecteur de fumée déclenché sans cause identifiée dans la zone d\'assemblage sud. ' +
    'L\'alarme s\'est déclenchée à 08:23 lors du démarrage de la ligne. ' +
    'Les techniciens de maintenance ont été dépêchés sur place pour inspection.',
  createdAt: '2026-07-30T08:23:15',
  declaredAt: '2026-07-30T08:23:15',
  claimedAt: '2026-07-30T08:45:00',
  inProgressAt: '2026-07-30T08:46:00',
  resolvedAt: null,
  closedAt: null,
  assignedTo: {
    id: '42',
    firstName: 'Ahmed',
    lastName: 'Bennani',
    matricule: '1001',
  },
  resolvedBy: null,
  resolutionNote: null,
  history: [
    {
      id: 'h1',
      action: 'Incident Declared',
      performedBy: { id: '5', firstName: 'Mohamed', lastName: 'Amraoui', matricule: '1005' },
      timestamp: '2026-07-30T08:23:15',
    },
    {
      id: 'h2',
      action: 'Claimed by',
      performedBy: { id: '42', firstName: 'Ahmed', lastName: 'Bennani', matricule: '1001' },
      timestamp: '2026-07-30T08:45:00',
    },
    {
      id: 'h3',
      action: 'In Progress',
      performedBy: { id: '42', firstName: 'Ahmed', lastName: 'Bennani', matricule: '1001' },
      timestamp: '2026-07-30T08:46:00',
      note: 'Auto-progression from CLAIMED to IN_PROGRESS',
    },
  ],
};

// ── Timeline Entry ────────────────────────────────

function TimelineIcon({ action }: { action: string }) {
  const iconMap: Record<string, React.ElementType> = {
    'Incident Declared': FileText,
    'Claimed by': UserCheck,
    'In Progress': Activity,
    Resolved: CheckCircle2,
    'Not Resolved': XCircle,
    Closed: XCircle,
  };
  const Icon = Object.entries(iconMap).find(([key]) =>
    action.toLowerCase().includes(key.toLowerCase()),
  )?.[1] ?? FileText;
  return <Icon className="h-3.5 w-3.5" />;
}

function TimelineEntry({ entry, isLast }: { entry: IncidentHistoryEntry; isLast: boolean }) {
  const date = new Date(entry.timestamp);
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="relative flex gap-4 pb-6">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
      )}
      {/* Dot */}
      <div className="relative z-10 mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border bg-card">
        <TimelineIcon action={entry.action} />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground">
            {entry.action}
          </span>
          <span className="text-xs text-muted-foreground">
            {dateStr} à {timeStr}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {entry.performedBy.firstName} {entry.performedBy.lastName}
          <span className="font-mono"> #{entry.performedBy.matricule}</span>
        </p>
        {entry.note && (
          <p className="mt-1 text-xs text-muted-foreground/70 italic border-l-2 border-muted pl-2">
            {entry.note}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────

export default function AdminIncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id as string;

  const [incident, setIncident] = useState<IncidentDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Try API first, fall back to mock
        setIncident({ ...MOCK_INCIDENT, id: incidentId });
      } catch {
        setError("Impossible de charger l'incident.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [incidentId]);

  const handleClaim = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    setIncident((prev) => prev ? { ...prev, status: 'CLAIMED', claimedAt: new Date().toISOString() } : prev);
    setLoading(false);
  };

  const handleEvaluate = async (status: 'RESOLVED' | 'NON_RESOLVED', note: string) => {
    setEvalLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setIncident((prev) =>
      prev
        ? {
            ...prev,
            status: status,
            resolvedAt: new Date().toISOString(),
            resolvedBy: { id: '1', firstName: 'Admin', lastName: 'User', matricule: 'ADM-0001' },
            resolutionNote: note,
            history: [
              ...prev.history,
              {
                id: `h${Date.now()}`,
                action: status === 'RESOLVED' ? 'Resolved' : 'Not Resolved',
                performedBy: { id: '1', firstName: 'Admin', lastName: 'User', matricule: 'ADM-0001' },
                timestamp: new Date().toISOString(),
                note,
              },
            ],
          }
        : prev,
    );
    setEvalLoading(false);
    setEvalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de l'incident...</p>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold">Erreur</h2>
        <p className="text-sm text-muted-foreground">{error ?? "Impossible de charger l'incident."}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
      </div>
    );
  }

  const cfg = getStatusConfig(incident.status);
  const CatIcon = getCategoryIcon(incident.category);
  const isResolvedOrClosed = incident.status === 'RESOLVED' || incident.status === 'CLOSED' || incident.status === 'NON_RESOLVED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-4xl space-y-6 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8"
    >
      {/* Back */}
      <button
        onClick={() => router.push('/admin/incidents')}
        className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Retour aux incidents
      </button>

      {/* ── Header & Meta ─────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{incident.reference}</h1>
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', PRIORITY_CLASSES[incident.priority])}>
              {PRIORITY_LABELS[incident.priority]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <CatIcon className="h-3 w-3" />
              {incident.category}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {incident.department}
              {incident.station && ` · ${incident.station}`}
            </span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.textClass, 'bg-muted/50')}>
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
              {cfg.labelFr}
            </span>
          </div>
        </div>

        {/* Triage actions */}
        <div className="flex items-center gap-2 shrink-0">
          {incident.status === 'DECLARED' && (
            <Button onClick={handleClaim} size="sm" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Prendre en charge
            </Button>
          )}
          {incident.status === 'IN_PROGRESS' && (
            <Button onClick={() => setEvalOpen(true)} size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700">
              <CheckCircle2 className="h-4 w-4" />
              Évaluer
            </Button>
          )}
          {incident.status === 'RESOLVED' && (
            <Badge variant="outline" className="gap-1.5 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
              <Clock className="h-3 w-3" />
              Clôture automatique ~10 min après résolution
            </Badge>
          )}
        </div>
      </div>

      {/* ── Description ───────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{incident.description}</p>
        </CardContent>
      </Card>

      {/* ── Reporter & assignee info ──────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Déclaré par</p>
            <p className="text-sm font-medium">
              {incident.history[0]?.performedBy.firstName} {incident.history[0]?.performedBy.lastName}
              <span className="font-mono text-muted-foreground"> #{incident.history[0]?.performedBy.matricule}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(incident.declaredAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              {incident.assignedTo ? 'Pris en charge par' : 'Assigné'}
            </p>
            {incident.assignedTo ? (
              <>
                <p className="text-sm font-medium">
                  {incident.assignedTo.firstName} {incident.assignedTo.lastName}
                  <span className="font-mono text-muted-foreground"> #{incident.assignedTo.matricule}</span>
                </p>
                {incident.claimedAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(incident.claimedAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">Non assigné</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Resolution info (if resolved) ─────────── */}
      {isResolvedOrClosed && incident.resolutionNote && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {incident.status === 'NON_RESOLVED' ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <h3 className="text-sm font-semibold">
                {incident.status === 'NON_RESOLVED' ? 'Note de non-résolution' : 'Note de résolution'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">{incident.resolutionNote}</p>
            {incident.resolvedBy && (
              <p className="mt-2 text-xs text-muted-foreground">
                par {incident.resolvedBy.firstName} {incident.resolvedBy.lastName}
                <span className="font-mono"> #{incident.resolvedBy.matricule}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Timeline ──────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-4">Historique</h3>
          <div className="space-y-0">
            {incident.history.map((entry, idx) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isLast={idx === incident.history.length - 1}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Evaluate Modal ─────────────────────────── */}
      <EvaluationModal
        open={evalOpen}
        onClose={() => setEvalOpen(false)}
        onSubmit={handleEvaluate}
        isSubmitting={evalLoading}
      />
    </motion.div>
  );
}
