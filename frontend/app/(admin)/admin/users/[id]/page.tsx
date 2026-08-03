'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  CalendarDays,
  AlertTriangle,
  Loader2,
  Lock,
  CheckCircle2,
  Hourglass,
  Pencil,
  ChevronRight,
  FileText,
  Activity,
  Timer,
  UserCheck,
  Inbox,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync, extractErrorMessage } from '@/lib/use-async';
import {
  getUser,
  getMe,
  promoteUser,
  demoteUser,
  cancelPromotion,
  activateUser,
  deactivateUser,
  updateUser,
  getActiveAdminCount,
  getUserActivity,
} from '@/services/userService';
import { getIncidents } from '@/services/incidentService';
import { getStatusConfig } from '@/lib/constants/incidentStatus';
import { ActivityHeatmap } from '@/components/dashboard/activity-heatmap';
import type { UserResponseDTO, UserActivityDTO } from '@/types/user';
import type { IncidentDTO } from '@/types/incident';

// ── Role / Status metadata ────────────────────────

const ROLE_META: Record<string, { label: string; badgeClass: string }> = {
  SOUS_CHEF: {
    label: 'Opérateur',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  CHEF_ATELIER: {
    label: "Chef d'atelier",
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  ADMIN: {
    label: 'Administrateur',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
};

function statusMeta(user: UserResponseDTO): { label: string; badgeClass: string; dotClass: string } {
  if (!user.isActive) {
    return { label: 'Inactif', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dotClass: 'bg-red-500' };
  }
  if (user.role === 'CHEF_ATELIER' && !user.claimed) {
    return { label: 'En attente', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dotClass: 'bg-amber-500' };
  }
  return { label: 'Actif', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dotClass: 'bg-emerald-500' };
}

// ── Helpers ───────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || Number.isNaN(totalMinutes) || totalMinutes <= 0) return '—';
  if (totalMinutes < 60) return `${Math.round(totalMinutes)} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ── Confirmation dialog state ─────────────────────

type DialogAction =
  | 'promote'
  | 'cancel-promotion'
  | 'demote'
  | 'deactivate'
  | 'activate'
  | null;

const DIALOG_CONTENT: Record<Exclude<DialogAction, null>, { title: string; description: string; confirmLabel: string; danger?: boolean }> = {
  promote: {
    title: 'Promouvoir en Chef d\'atelier ?',
    description:
      "Le rôle de cet utilisateur sera immédiatement mis à jour. L'utilisateur devra obligatoirement finaliser la création de son mot de passe via le flux de réclamation pour se connecter en tant que Chef d'atelier.",
    confirmLabel: 'Promouvoir',
  },
  'cancel-promotion': {
    title: 'Annuler la promotion ?',
    description:
      "La promotion en cours sera annulée : le rôle sera rétabli en Opérateur (SOUS_CHEF), les jetons de réinitialisation en attente seront supprimés et le compte repassera au statut Actif.",
    confirmLabel: 'Annuler la promotion',
    danger: true,
  },
  demote: {
    title: 'Rétrograder en Opérateur ?',
    description:
      "L'utilisateur sera rétrogradé au rôle d'Opérateur (SOUS_CHEF) et son affectation de département sera réinitialisée. Son mot de passe sera immédiatement réinitialisé. S'il est repromu ultérieurement, il devra repasser par le flux de réclamation.",
    confirmLabel: 'Rétrograder',
    danger: true,
  },
  deactivate: {
    title: 'Désactiver le compte ?',
    description:
      "L'utilisateur perdra immédiatement ses accès de connexion. Ses incidents déclarés et ses entrées d'audit historiques resteront intacts et attribués à son matricule.",
    confirmLabel: 'Désactiver',
    danger: true,
  },
  activate: {
    title: 'Réactiver le compte ?',
    description: "L'utilisateur retrouvera immédiatement ses accès de connexion.",
    confirmLabel: 'Réactiver',
  },
};

// ── Stat card (small) ─────────────────────────────

function MiniStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </div>
        <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  const [action, setAction] = useState<DialogAction>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // ── Data ─────────────────────────────────────────
  const { data: user, loading, error, refetch } = useAsync<UserResponseDTO>(
    () => getUser(userId),
    [userId],
  );
  const { data: me } = useAsync<UserResponseDTO>(getMe, []);
  const { data: activity, loading: activityLoading, error: activityError, refetch: refetchActivity } =
    useAsync<UserActivityDTO>(() => getUserActivity(userId), [userId]);
  // Recent incidents are only relevant for reporters (SOUS_CHEF / CHEF_ATELIER).
  const { data: incidents, loading: incidentsLoading } = useAsync(
    () =>
      user?.role === 'ADMIN'
        ? Promise.resolve(null)
        : getIncidents({ userId, page: 0, size: 10, sort: 'declaredAt,desc' }),
    [user?.role, userId],
  );
  const { data: adminCount } = useAsync(
    () => (user?.role === 'ADMIN' ? getActiveAdminCount() : Promise.resolve(null)),
    [user?.role],
  );

  // Re-fetch when the route id changes
  const [prevId, setPrevId] = useState(userId);
  useEffect(() => {
    if (prevId !== userId) {
      setPrevId(userId);
      refetch();
      refetchActivity();
    }
  }, [userId, prevId, refetch, refetchActivity]);

  // ── Derived state ────────────────────────────────
  const status = user ? statusMeta(user) : null;
  const isSelf = me?.id === userId;
  // While the count is still loading (null), do NOT lock — the server guard
  // is authoritative anyway.
  const isLastActiveAdmin =
    user?.role === 'ADMIN' &&
    user.isActive &&
    adminCount !== null &&
    adminCount.activeAdminCount <= 1;

  const recentIncidents = useMemo(() => {
    const list = incidents?.content ?? [];
    return [...list]
      .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime())
      .slice(0, 10);
  }, [incidents]);

  const showDepartment = user && user.role !== 'ADMIN';

  // ── Actions ──────────────────────────────────────
  const runAction = async (fn: () => Promise<unknown>, successClose: boolean) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await Promise.all([refetch(), refetchActivity()]);
      if (successClose) setAction(null);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = () => runAction(() => promoteUser(userId), true);
  const handleCancelPromotion = () => runAction(() => cancelPromotion(userId), true);
  const handleDemote = () => runAction(() => demoteUser(userId), true);
  const handleDeactivate = () => runAction(() => deactivateUser(userId), true);
  const handleActivate = () => runAction(() => activateUser(userId), true);

  const openEdit = () => {
    setEditFirstName(user?.firstName ?? '');
    setEditLastName(user?.lastName ?? '');
    setEditReason('');
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      setEditError('Le prénom et le nom sont obligatoires.');
      return;
    }
    if (!editReason.trim()) {
      setEditError('Un motif de correction est obligatoire pour traçabilité.');
      return;
    }
    setBusy(true);
    setEditError(null);
    try {
      // Names only — the role/department are never touched from here.
      await updateUser(userId, { firstName: editFirstName.trim(), lastName: editLastName.trim() });
      setEditOpen(false);
      await refetch();
    } catch (err) {
      setEditError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ── Loading / error states ───────────────────────
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6">
        <ErrorState message={error ?? "Impossible de charger l'utilisateur."} onRetry={refetch} />
        <Button variant="outline" onClick={() => router.push('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux utilisateurs
        </Button>
      </div>
    );
  }

  const roleMeta = ROLE_META[user.role] ?? ROLE_META.SOUS_CHEF;
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-4xl space-y-6 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-8"
    >
      {/* Back */}
      <button
        onClick={() => router.push('/users')}
        className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Retour aux utilisateurs
      </button>

      {/* ── 5.1 Identity Header ───────────────────── */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              {/* Avatar — tinted initials */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {initials || 'U'}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight truncate sm:text-2xl">
                    {user.firstName} {user.lastName}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                    #{user.matricule}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Role badge */}
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', roleMeta.badgeClass)}>
                    <Shield className="h-3 w-3" />
                    {roleMeta.label}
                  </span>
                  {/* Status badge */}
                  {status && (
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', status.badgeClass)}>
                      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', status.dotClass)} />
                      {status.label}
                    </span>
                  )}
                  {/* Department — omitted entirely for ADMIN */}
                  {showDepartment && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                      <User className="h-3 w-3" />
                      Département : {user.department?.name ?? 'Non assigné'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Corriger les informations — §5.5: never inline */}
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Corriger les informations
            </Button>
          </div>

          {/* ── 5.2 Audit / Metadata strip ─────────── */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">Créé le</p>
                <p className="truncate font-medium text-foreground/80">{formatDateTime(user.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground" title="Non suivi (pas de colonne en base)">
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">Promotion</p>
                <p className="truncate font-medium text-foreground/80">—</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground" title="Non suivi (pas de colonne en base)">
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">Réclamation</p>
                <p className="truncate font-medium text-foreground/80">—</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground" title="Non suivi (pas de colonne en base)">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">Dernière connexion</p>
                <p className="truncate font-medium text-foreground/80">Jamais connecté</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Action error banner ───────────────────── */}
      {actionError && (
        <ErrorState message={actionError} compact onRetry={() => setActionError(null)} />
      )}

      {/* ── 5.3 Admin actions ─────────────────────── */}
      <div className="space-y-3">
          {/* Role transition — depends on the current role state */}
          {user.role === 'SOUS_CHEF' && user.isActive && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3.5">
              <div>
                <p className="text-sm font-medium">Promouvoir en Chef d&apos;atelier</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  L&apos;utilisateur devra réclamer son compte (mot de passe) avant de se connecter.
                </p>
              </div>
              <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={() => setAction('promote')}>
                <UserCheck className="h-3.5 w-3.5" />
                Promouvoir en Chef d&apos;atelier
              </Button>
            </div>
          )}

          {user.role === 'CHEF_ATELIER' && !user.claimed && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3.5">
              <div className="flex items-start gap-2.5">
                <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium">Promotion en attente de réclamation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Le compte a été promu mais l&apos;utilisateur n&apos;a pas encore créé son mot de passe.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400" onClick={() => setAction('cancel-promotion')}>
                <ShieldX className="h-3.5 w-3.5" />
                Annuler la promotion
              </Button>
            </div>
          )}

          {user.role === 'CHEF_ATELIER' && user.claimed && user.isActive && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3.5">
              <div>
                <p className="text-sm font-medium">Rétrograder en Opérateur</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Réinitialise le mot de passe et l&apos;affectation de département.
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400" onClick={() => setAction('demote')}>
                <ShieldX className="h-3.5 w-3.5" />
                Rétrograder en Opérateur
              </Button>
            </div>
          )}

          {/* Deactivate / Reactivate toggle */}
          {user.isActive ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3.5">
              <div>
                <p className="text-sm font-medium">Désactiver le compte</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Supprime l&apos;accès de connexion (l&apos;historique et les incidents restent intacts).
                </p>
              </div>
              {isSelf ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md border border-input bg-muted px-3 text-xs font-medium text-muted-foreground"
                  title="Impossible de désactiver votre propre compte."
                >
                  <Lock className="h-3.5 w-3.5" />
                  Désactiver le compte
                </button>
              ) : isLastActiveAdmin ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md border border-input bg-muted px-3 text-xs font-medium text-muted-foreground"
                  title="Action impossible : il s'agit du dernier administrateur actif du système."
                >
                  <Lock className="h-3.5 w-3.5" />
                  Désactiver le compte
                </button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400" onClick={() => setAction('deactivate')}>
                  <ShieldX className="h-3.5 w-3.5" />
                  Désactiver le compte
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3.5">
              <div>
                <p className="text-sm font-medium">Réactiver le compte</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Restaure les accès de connexion de l&apos;utilisateur.
                </p>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAction('activate')}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Réactiver le compte
              </Button>
            </div>
          )}
      </div>

      {/* ── 5.4 Role-conditioned activity ─────────── */}
      <div className="space-y-5">
        {user.role === 'ADMIN' ? (
          <>
            <div>
              <h2 className="text-base font-semibold">Activité de traitement</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Incidents pris en charge et résolus par cet administrateur.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat label="Pris en charge" value={activity?.claimedCount ?? '…'} icon={UserCheck} />
              <MiniStat label="Résolus" value={activity?.resolvedCount ?? '…'} icon={CheckCircle2} />
              <MiniStat label="Prise en charge moy." value={formatMinutes(activity?.avgTimeToClaimMinutes)} icon={Timer} />
              <MiniStat label="MTTR moyen" value={formatMinutes(activity?.avgMttrMinutes)} icon={Activity} />
            </div>
            <ActivityHeatmap
              data={activity?.resolvedByDay ?? []}
              title="Résolutions (12 mois)"
              emptyLabel="Aucune résolution enregistrée sur cette période."
              unit="résolution"
            />
          </>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold">Activité de déclaration</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Incidents déclarés par cet opérateur ou chef d&apos;atelier.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat label="Total déclarés" value={activity?.declaredCount ?? '…'} icon={FileText} />
              <MiniStat label="Actuellement ouverts" value={activity?.openCount ?? '…'} icon={Activity} />
              <MiniStat label="Résolus" value={activity?.resolvedCount ?? '…'} icon={CheckCircle2} />
              <MiniStat label="Clôturés" value={activity?.closedCount ?? '…'} icon={ShieldCheck} />
            </div>

            {/* Recent incidents — last 10 declared */}
            <Card>
              <CardHeader className="px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Derniers incidents déclarés
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {incidentsLoading ? (
                  <div className="divide-y divide-border">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="ml-auto h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : recentIncidents.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Inbox}
                    title="Aucun incident déclaré."
                    description="Les incidents apparaîtront ici dès leur déclaration."
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {recentIncidents.map((inc: IncidentDTO) => {
                      const cfg = getStatusConfig(inc.status);
                      return (
                        <Link
                          key={inc.id}
                          href={`/admin/incidents/${inc.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 group"
                        >
                          <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {inc.reference}
                          </span>
                          <span className="hidden sm:block text-xs text-muted-foreground truncate">
                            {inc.category}
                          </span>
                          <span className={cn('ml-auto text-xs font-medium', cfg.textClass)}>
                            {cfg.labelFr}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateTime(inc.declaredAt)}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <ActivityHeatmap
              data={activity?.declaredByDay ?? []}
              title="Déclarations (12 mois)"
              emptyLabel="Aucune déclaration enregistrée sur cette période."
              unit="déclaration"
            />
          </>
        )}
      </div>

      {/* ── Confirmation dialogs ──────────────────── */}
      <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !busy) setAction(null); }}>            <DialogContent className="sm:max-w-md">
          {action && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {DIALOG_CONTENT[action].danger && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  {DIALOG_CONTENT[action].title}
                </DialogTitle>
                <DialogDescription className="pt-1 leading-relaxed">
                  {DIALOG_CONTENT[action].description}
                </DialogDescription>
              </DialogHeader>

              {/* Inline error — visible while the dialog stays open for retry */}
              {actionError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>
                  Annuler
                </Button>
                <Button
                  onClick={() => {
                    if (action === 'promote') handlePromote();
                    else if (action === 'cancel-promotion') handleCancelPromotion();
                    else if (action === 'demote') handleDemote();
                    else if (action === 'deactivate') handleDeactivate();
                    else if (action === 'activate') handleActivate();
                  }}
                  disabled={busy}
                  className={cn(
                    'gap-2',
                    DIALOG_CONTENT[action].danger
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white',
                  )}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {DIALOG_CONTENT[action].confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Corriger les informations modal (§5.5) ── */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open && !busy) setEditOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Corriger les informations</DialogTitle>
            <DialogDescription>
              Seuls le prénom et le nom peuvent être corrigés. Le matricule est une clé de
              connexion et reste strictement en lecture seule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-firstname">Prénom</Label>
                <Input id="edit-firstname" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lastname">Nom</Label>
                <Input id="edit-lastname" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
            </div>
            {/* Matricule — locked, read-only */}
            <div className="space-y-1.5">
              <Label>Matricule</Label>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 font-mono text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>#{user.matricule}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-reason">
                Motif de la correction <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="edit-reason"
                rows={3}
                value={editReason}
                onChange={(e) => { setEditReason(e.target.value); if (editError) setEditError(null); }}
                placeholder="Expliquez le motif (obligatoire pour traçabilité)..."
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={handleEditSubmit} disabled={busy} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
