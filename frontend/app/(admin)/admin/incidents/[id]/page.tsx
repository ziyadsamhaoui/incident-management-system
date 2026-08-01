'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  AlertTriangle,
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
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getStatusConfig } from '@/lib/constants/incidentStatus';
import { EvaluationModal } from '@/components/incidents/evaluation-modal';
import { ErrorState } from '@/components/ui/error-state';
import { useAsync, extractErrorMessage } from '@/lib/use-async';
import { getIncidentDetail, claimIncident, evaluateIncident } from '@/services/incidentService';
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

const STATUS_ACTION_LABELS: Record<string, string> = {
  DECLARED: 'Incident Declared',
  CLAIMED: 'Claimed by',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  NON_RESOLVED: 'Not Resolved',
  CLOSED: 'Closed',
};

// ── Timeline Entry ────────────────────────────────

function TimelineIcon({ status }: { status: string }) {
  const iconMap: Record<string, React.ElementType> = {
    DECLARED: FileText,
    CLAIMED: UserCheck,
    IN_PROGRESS: Activity,
    RESOLVED: CheckCircle2,
    NON_RESOLVED: XCircle,
    CLOSED: XCircle,
  };
  const Icon = iconMap[status] ?? FileText;
  return <Icon className="h-3.5 w-3.5" />;
}

function TimelineEntry({ entry, isLast }: { entry: IncidentHistoryEntry; isLast: boolean }) {
  const date = new Date(entry.changedAt);
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const action = STATUS_ACTION_LABELS[entry.currentStatus] ?? entry.currentStatus;
  const actor = entry.actor;

  return (
    <div className="relative flex gap-4 pb-6">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
      )}
      {/* Dot */}
      <div className="relative z-10 mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border bg-card">
        <TimelineIcon status={entry.currentStatus} />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground">
            {action}
          </span>
          <span className="text-xs text-muted-foreground">
            {dateStr} à {timeStr}
          </span>
        </div>
        {actor && (
          <p className="text-xs text-muted-foreground">
            {actor.firstName} {actor.lastName}
            <span className="font-mono"> #{actor.matricule}</span>
          </p>
        )}
        {entry.comment && (
          <p className="mt-1 text-xs text-muted-foreground/70 italic border-l-2 border-muted pl-2">
            {entry.comment}
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

  const [evalOpen, setEvalOpen] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: incident, loading, error, refetch } = useAsync<IncidentDetailDTO>(
    () => getIncidentDetail(incidentId),
    [incidentId],
  );

  // Re-fetch when the route id changes
  const [prevId, setPrevId] = useState(incidentId);
  useEffect(() => {
    if (prevId !== incidentId) {
      setPrevId(incidentId);
      refetch();
    }
  }, [incidentId, prevId, refetch]);

  const handleClaim = async () => {
    setActionError(null);
    try {
      await claimIncident(incidentId);
      await refetch();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const handleEvaluate = async (status: 'RESOLVED' | 'NON_RESOLVED', note: string) => {
    setEvalLoading(true);
    setActionError(null);
    try {
      await evaluateIncident(incidentId, { status, note });
      await refetch();
      setEvalOpen(false);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setEvalLoading(false);
    }
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
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6">
        <ErrorState message={error ?? "Impossible de charger l'incident."} onRetry={refetch} />
        <Button variant="outline" onClick={() => router.push('/admin/incidents')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux incidents
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

      {/* ── Action error banner ───────────────────── */}
      {actionError && (
        <ErrorState message={actionError} compact onRetry={() => setActionError(null)} />
      )}

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
              {incident.user?.firstName ?? '—'} {incident.user?.lastName ?? ''}
              <span className="font-mono text-muted-foreground"> #{incident.user?.matricule ?? ''}</span>
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
          {incident.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement enregistré pour cet incident.</p>
          ) : (
            <div className="space-y-0">
              {incident.history.map((entry, idx) => (
                <TimelineEntry
                  key={entry.id}
                  entry={entry}
                  isLast={idx === incident.history.length - 1}
                />
              ))}
            </div>
          )}
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
