'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Cpu,
  Tag,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  UserCheck,
  Shield,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IncidentStepper } from '@/components/incidents/incident-stepper';
import { EvaluationModal } from '@/components/incidents/evaluation-modal';
import { StatusDotLabel } from '@/lib/constants/incidentStatus';
import {
  claimIncident,
  progressIncident,
  evaluateIncident,
} from '@/services/incidentService';
import type {
  IncidentDTO,
  IncidentDetailDTO,
  IncidentStatus,
  IncidentPriority,
  IncidentUserSummary,
  IncidentHistoryEntry,
} from '@/types/incident';

// ── Types ─────────────────────────────────────────

type UserRole = 'ADMIN' | 'CHEF_ATELIER' | 'SOUS_CHEF';

const PRIORITY_VARIANTS: Record<IncidentPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
};

const PRIORITY_LABELS: Record<IncidentPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

// ── PII helpers ───────────────────────────────────

function maskAdminName(user: IncidentUserSummary | null | undefined): string {
  if (!user) return '—';
  return "Superviseur d'atelier";
}

function formatAuditLabel(user: IncidentUserSummary | null | undefined): string {
  if (!user) return '—';
  return `${user.firstName} ${user.lastName} (#${user.matricule})`;
}

// ── Sub-components ────────────────────────────────

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-3 transition-colors hover:bg-muted/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function AuditEntry({ entry }: { entry: IncidentHistoryEntry }) {
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-background">
          <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
        </div>
        <div className="mt-1 h-full w-0.5 bg-border" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 rounded-lg border bg-card/50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{entry.currentStatus}</p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDateTime(entry.changedAt)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            par{' '}
            <span className="font-mono font-medium text-foreground/80">
              {formatAuditLabel(entry.actor)}
            </span>
          </p>
          {entry.comment && (
            <p className="mt-1 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
              {entry.comment}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────

export interface IncidentDetailContentProps {
  incident: IncidentDetailDTO | IncidentDTO;
  onIncidentUpdated?: (updated: IncidentDTO) => void;
  actionLoading?: string | null;
  onActionLoadingChange?: (key: string | null) => void;
  compact?: boolean;
}

// ── Main Component ────────────────────────────────

export function IncidentDetailContent({
  incident: initialIncident,
  onIncidentUpdated,
  actionLoading: externalActionLoading,
  onActionLoadingChange,
  compact = false,
}: IncidentDetailContentProps) {
  const { roles } = useAuthStore();
  const primaryRole = (roles[0]?.replace('ROLE_', '') ?? 'CHEF_ATELIER') as UserRole;

  const [internalActionLoading, setInternalActionLoading] = useState<string | null>(null);
  const [incident, setIncident] = useState<IncidentDTO | IncidentDetailDTO>(initialIncident);
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);

  useEffect(() => {
    setIncident(initialIncident);
  }, [initialIncident]);

  const actionLoading = externalActionLoading ?? internalActionLoading;

  const setLoading = useCallback(
    (key: string | null) => {
      if (onActionLoadingChange) {
        onActionLoadingChange(key);
      } else {
        setInternalActionLoading(key);
      }
    },
    [onActionLoadingChange],
  );

  // ── Auto-progress guard for ADMIN ─────────────────
  const autoProgressAttempted = useRef(false);

  useEffect(() => {
    if (
      primaryRole !== 'ADMIN' ||
      incident.status !== 'CLAIMED' ||
      actionLoading ||
      autoProgressAttempted.current
    )
      return;

    const safeId = incident.id;
    autoProgressAttempted.current = true;
    let cancelled = false;

    async function autoProgress() {
      setLoading('progress');
      try {
        const updated = await progressIncident(safeId);
        if (!cancelled) {
          setIncident(updated);
          onIncidentUpdated?.(updated);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) {
          setLoading(null);
        }
      }
    }

    autoProgress();

    return () => {
      cancelled = true;
    };
  }, [incident, primaryRole, actionLoading, setLoading, onIncidentUpdated]);

  // ── Claim handler ────────────────────────────────
  const handleClaim = useCallback(async () => {
    setLoading('claim');
    try {
      const updated = await claimIncident(incident.id);
      setIncident(updated);
      onIncidentUpdated?.(updated);
    } catch {
      // Error handled silently
    } finally {
      setLoading(null);
    }
  }, [incident, setLoading, onIncidentUpdated]);

  // ── Evaluate handler ─────────────────────────────
  const handleEvaluate = useCallback(
    async (status: 'RESOLVED' | 'NON_RESOLVED', note: string) => {
      setLoading('evaluate');
      try {
        const updated = await evaluateIncident(incident.id, { status, note });
        setIncident(updated);
        onIncidentUpdated?.(updated);
        setEvaluationModalOpen(false);
      } catch {
        // Error handled silently
      } finally {
        setLoading(null);
      }
    },
    [incident, setLoading, onIncidentUpdated],
  );

  // ── Derived values ───────────────────────────────
  const claimedBy = incident.assignedTo;
  const resolvedBy = incident.resolvedBy;
  const isSousChef = primaryRole === 'SOUS_CHEF';
  const isChefAtelier = primaryRole === 'CHEF_ATELIER';
  const isAdmin = primaryRole === 'ADMIN';
  const isNonResolved = incident.status === 'NON_RESOLVED';

  return (
    <div className={cn(
      'space-y-5',
      !compact && 'flex flex-col flex-1',
      compact && 'space-y-4',
    )}>
      {/* ── Header Section ───────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={cn(
              'font-bold tracking-tight font-mono',
              compact ? 'text-xl' : 'text-2xl',
            )}>
              {incident.reference}
            </h1>
            {/* Status — Dot + Text indicator */}
            <StatusDotLabel status={incident.status} />
            {/* Priority badge */}
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                PRIORITY_VARIANTS[incident.priority],
              )}
            >
              {PRIORITY_LABELS[incident.priority]}
            </span>
          </div>
        </div>

        {isAdmin && (
          <Badge variant="outline" className="gap-1.5 shrink-0">
            <Shield className="h-3 w-3" />
            Administrateur
          </Badge>
        )}
      </div>

      {/* ── Meta Grid ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaItem icon={Building2} label="Département" value={incident.department} />
        <MetaItem icon={Cpu} label="Station" value={incident.station} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaItem icon={Tag} label="Catégorie / Type" value={incident.category} />
        <MetaItem icon={Clock} label="Déclaré le" value={formatDateTime(incident.declaredAt)} />
      </div>

      {/* ── Description Block ────────────────────── */}
      <Card className={cn(!compact && 'flex-1 flex flex-col')}>
        <CardHeader className={cn(compact ? 'px-4 py-3' : 'shrink-0')}>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Description
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(compact ? 'px-4 pb-4' : 'flex-1 flex flex-col')}>
          <p className={cn(
            'whitespace-pre-wrap text-sm leading-relaxed text-foreground/90',
            !compact && 'flex-1 overflow-y-auto',
          )}>
            {incident.description}
          </p>
        </CardContent>
      </Card>

      {/* ── Status Timeline Stepper ──────────────── */}
      <Card>
        <CardHeader className={compact ? 'px-4 py-3' : undefined}>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            Progression
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4' : undefined}>
          <IncidentStepper
            status={incident.status}
            declaredAt={incident.declaredAt}
            claimedAt={incident.claimedAt}
            inProgressAt={incident.inProgressAt}
            resolvedAt={incident.resolvedAt ?? incident.closedAt}
            isNonResolved={isNonResolved}
          />
        </CardContent>
      </Card>

      {/* ── Resolution Note ──────────────────────── */}
      {(incident.status === 'RESOLVED' || incident.status === 'NON_RESOLVED') &&
        incident.resolutionNote && (
          <Card>
            <CardHeader className={compact ? 'px-4 py-3' : undefined}>
              <CardTitle className="flex items-center gap-2 text-base">
                {incident.status === 'RESOLVED' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                Note de résolution
              </CardTitle>
            </CardHeader>
            <CardContent className={compact ? 'px-4 pb-4' : undefined}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {incident.resolutionNote}
              </p>
              <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5" />
                {isSousChef ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Superviseur d'atelier</span>
                  </>
                ) : (
                  <span className="font-medium text-foreground/80">
                    Évalué par {formatAuditLabel(resolvedBy)}
                  </span>
                )}
                <span className="mx-1">·</span>
                <span>{formatDateTime(incident.resolvedAt)}</span>
              </div>
            </CardContent>
          </Card>
        )}

      {/* ── Action Controls (ADMIN only) ──────────── */}
      {isAdmin && (
        <div className={cn('flex flex-wrap gap-3', compact && 'sticky bottom-0 bg-background pt-2 pb-1 border-t')}>
          {incident.status === 'DECLARED' && (
            <Button onClick={handleClaim} disabled={actionLoading === 'claim'} className="gap-2">
              {actionLoading === 'claim' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Claim Incident
            </Button>
          )}
          {incident.status === 'IN_PROGRESS' && (
            <Button onClick={() => setEvaluationModalOpen(true)} disabled={actionLoading === 'evaluate'} className="gap-2">
              {actionLoading === 'evaluate' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Evaluate Incident
            </Button>
          )}
          {incident.status === 'CLAIMED' && actionLoading === 'progress' && (
            <div className="flex items-center gap-2 rounded-lg border bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Automated progression...
            </div>
          )}
        </div>
      )}

      {/* ── Claimed By / Assigned To display ───────── */}
      {(claimedBy || resolvedBy) && (
        <Card>
          <CardHeader className={compact ? 'px-4 py-3' : undefined}>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              {isSousChef ? 'Responsable' : 'Attribué à'}
            </CardTitle>
          </CardHeader>
          <CardContent className={compact ? 'px-4 pb-4' : undefined}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {claimedBy && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Réclamé par
                  </p>
                  <p className="text-sm font-medium">
                    {isSousChef ? maskAdminName(claimedBy) : formatAuditLabel(claimedBy)}
                  </p>
                </div>
              )}
              {resolvedBy && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Résolu par
                  </p>
                  <p className="text-sm font-medium">
                    {isSousChef ? maskAdminName(resolvedBy) : formatAuditLabel(resolvedBy)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Full Audit History ───────────────────── */}
      {!isSousChef && 'history' in incident && incident.history && incident.history.length > 0 && (
        <Card>
          <CardHeader className={compact ? 'px-4 py-3' : undefined}>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Historique des actions
            </CardTitle>
          </CardHeader>
          <CardContent className={compact ? 'px-4 pb-4' : undefined}>
            <div className="space-y-0">
              {incident.history.map((entry) => (
                <AuditEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── PII notice for SOUS_CHEF ───────────────── */}
      {isSousChef && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>
            Les informations d'identification des superviseurs sont masquées
            conformément à la politique de confidentialité.
          </span>
        </div>
      )}

      <EvaluationModal
        open={evaluationModalOpen}
        onClose={() => setEvaluationModalOpen(false)}
        onSubmit={handleEvaluate}
        isSubmitting={actionLoading === 'evaluate'}
      />
    </div>
  );
}
