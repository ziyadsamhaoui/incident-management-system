'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  XCircle,
  ChevronRight,
  ShieldCheck,
  AlertOctagon,
  UserCheck,
  Eye,
  Inbox,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getStatusConfig } from '@/lib/constants/incidentStatus';
import { ActivityHeatmap } from '@/components/dashboard/activity-heatmap';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { StatGridSkeleton, TableSkeleton, ChartBlockSkeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/lib/use-async';
import { getDashboardStats, getActivityLog } from '@/services/dashboardService';
import { getIncidents, getStaleIncidents } from '@/services/incidentService';
import type { IncidentDTO } from '@/types/incident';
import type { ActivityLogEntry } from '@/types/dashboard';

// ── Helpers ───────────────────────────────────────

function relativeTime(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m`;
  return `${Math.floor(diffHours / 24)}j`;
}

function formatElapsed(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

function fmtDuration(ms: number | null): string {
  if (ms == null || Number.isNaN(ms)) return '—';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

// ── Stat Card ─────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: 'default' | 'red' | 'amber' | 'green' | 'blue' | 'slate';
}

function StatCard({ label, value, icon: Icon, accent = 'default' }: StatCardProps) {
  const accentStyles: Record<string, string> = {
    default: 'border-slate-200 dark:border-slate-700',
    red: 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
    amber: 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    green: 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    blue: 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    slate: 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400',
  };

  const iconColors: Record<string, string> = {
    default: 'text-muted-foreground',
    red: 'text-red-500',
    amber: 'text-amber-500',
    green: 'text-emerald-500',
    blue: 'text-blue-500',
    slate: 'text-slate-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-l-4',
        accentStyles[accent],
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
            <Icon className={cn('h-4 w-4', iconColors[accent])} />
          </div>
          <div className={cn(
            'text-2xl font-bold tracking-tight',
            accent === 'red' && 'text-red-600 dark:text-red-400',
            accent === 'green' && 'text-emerald-600 dark:text-emerald-400',
          )}>
            {value}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Chart Colors ──────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DECLARED: '#64748b',
  CLAIMED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
  NON_RESOLVED: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  DECLARED: 'Déclaré',
  CLAIMED: 'Pris en charge',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  NON_RESOLVED: 'Non résolu',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Élevée',
  CRITICAL: 'Critique',
};

const DEPARTMENT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

// ── Chart Tooltip ─────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-xs text-slate-600 dark:text-slate-400" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {payload[0].name}: {payload[0].value}
      </p>
    </div>
  );
}

// ── Critical Incident Banner Item ─────────────────

function CriticalBannerItem({
  incident,
  index,
}: {
  incident: IncidentDTO;
  index: number;
}) {
  const { startNavigation } = useNavigationProgress();
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
    >
      <Link
        href={`/admin/incidents/${incident.id}`}
        onClick={startNavigation}
        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-rose-100/50 dark:hover:bg-rose-950/30 transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AlertOctagon className="h-4 w-4 shrink-0 text-rose-500" />
          <span className="font-mono text-sm font-medium text-rose-700 dark:text-rose-300 truncate">
            {incident.reference}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400">
            {incident.department}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-rose-500 dark:text-rose-400">
            {incident.status === 'DECLARED'
              ? relativeTime(incident.declaredAt)
              : formatElapsed(incident.claimedAt ?? incident.declaredAt)}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-rose-300 group-hover:text-rose-500 transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}

// ── Activity Feed ─────────────────────────────────

const STATUS_ICONS: Record<string, { icon: React.ElementType; iconClass: string }> = {
  DECLARED: { icon: FileText, iconClass: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
  CLAIMED: { icon: UserCheck, iconClass: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  IN_PROGRESS: { icon: Activity, iconClass: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  RESOLVED: { icon: CheckCircle2, iconClass: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
  NON_RESOLVED: { icon: XCircle, iconClass: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
};

function activityText(entry: ActivityLogEntry): string {
  const transition = entry.previousStatus && entry.currentStatus
    ? `${STATUS_LABELS[entry.previousStatus] ?? entry.previousStatus} → ${STATUS_LABELS[entry.currentStatus] ?? entry.currentStatus}`
    : STATUS_LABELS[entry.currentStatus ?? ''] ?? 'Mise à jour';
  return `${entry.incidentReference ?? 'Incident'} — ${transition}`;
}

function ActivityIcon({ status }: { status: string | null }) {
  const cfg = STATUS_ICONS[status ?? ''] ?? STATUS_ICONS.DECLARED;
  const Icon = cfg.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

// ── Page ──────────────────────────────────────────

export default function AdminDashboardPage() {
  const { startNavigation } = useNavigationProgress();

  const statsFetch = useAsync(() => getDashboardStats(), []);
  const incidentsFetch = useAsync(() => getIncidents({ size: 200 }), []);
  const staleFetch = useAsync(() => getStaleIncidents(), []);
  const activityFetch = useAsync(() => getActivityLog(), []);

  const stats = statsFetch.data;
  const incidents = incidentsFetch.data?.content ?? [];

  // 4.1 — 6-card stat grid from real dashboard stats
  const statCards = useMemo(() => {
    const byStatus = stats?.byStatus ?? {};
    const byPriority = stats?.byPriority ?? {};
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    // The "Critiques" counter counts critical incidents still OPEN — resolved /
    // non-resolved (terminal) criticals must not inflate it. Falls back to the
    // priority stat while the incidents list is still loading.
    const openCriticals = incidents.filter(
      (i) => i.priority === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'NON_RESOLVED',
    ).length;
    return {
      total,
      nonTraites: byStatus.DECLARED ?? 0,
      critiques: incidentsFetch.data ? openCriticals : (byPriority.CRITICAL ?? 0),
      enTraitement: (byStatus.CLAIMED ?? 0) + (byStatus.IN_PROGRESS ?? 0),
      resolus: byStatus.RESOLVED ?? 0,
      nonResolus: byStatus.NON_RESOLVED ?? 0,
    };
  }, [stats, incidents, incidentsFetch.data]);

  // 4.2 — Critical incidents still OPEN (real data, filtered client-side).
  // Resolved / non-resolved (terminal) criticals must leave the "critical now"
  // hero widget — only DECLARED / CLAIMED / IN_PROGRESS qualify.
  const criticalIncidents = useMemo(
    () =>
      incidents.filter(
        (i) =>
          i.priority === 'CRITICAL' &&
          (i.status === 'DECLARED' || i.status === 'CLAIMED' || i.status === 'IN_PROGRESS'),
      ),
    [incidents],
  );

  // 4.3 — Chart data from real dashboard stats
  const statusChartData = useMemo(() => {
    const byStatus = stats?.byStatus ?? {};
    return (Object.keys(STATUS_LABELS) as string[])
      .filter((s) => (byStatus[s] ?? 0) > 0)
      .map((s) => ({
        name: STATUS_LABELS[s] ?? s,
        value: byStatus[s],
        color: STATUS_COLORS[s],
      }));
  }, [stats]);

  const deptChartData = useMemo(() => {
    const byDept = stats?.byDepartment ?? {};
    return Object.entries(byDept).map(([name, value], idx) => ({
      name,
      value,
      fill: DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length],
    }));
  }, [stats]);

  const priorityChartData = useMemo(() => {
    const byPriority = stats?.byPriority ?? {};
    return (Object.keys(PRIORITY_LABELS) as string[])
      .map((p) => ({
        name: PRIORITY_LABELS[p] ?? p,
        value: byPriority[p] ?? 0,
        fill: PRIORITY_COLORS[p],
      }))
      .filter((d) => d.value > 0);
  }, [stats]);

  // 4.3 — Aging incidents from the real stale endpoint
  const agingIncidents = staleFetch.data ?? [];

  // 4.3 — MTTR / time-to-claim computed from real incidents
  const metrics = useMemo(() => {
    const claimed = incidents.filter((i) => i.claimedAt);
    const resolved = incidents.filter((i) => i.resolvedAt);
    const avg = (arr: IncidentDTO[], key: 'claimedAt' | 'resolvedAt') => {
      if (arr.length === 0) return null;
      const totalMs = arr.reduce((sum, i) => {
        const start = new Date(i.declaredAt).getTime();
        const end = i[key] ? new Date(i[key]!).getTime() : start;
        return sum + (end - start);
      }, 0);
      return totalMs / arr.length;
    };
    return {
      timeToClaim: avg(claimed, 'claimedAt'),
      mttr: avg(resolved, 'resolvedAt'),
    };
  }, [incidents]);

  const hasAnyStats = statsFetch.data != null;
  const hasStatsData = Object.keys(stats?.byStatus ?? {}).some((k) => (stats?.byStatus[k] ?? 0) > 0);

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble des incidents et indicateurs clés
        </p>
      </div>

      {/* ── 4.1 — Top Stat Row (6 cards, 2x3 grid) ── */}
      {statsFetch.loading ? (
        <StatGridSkeleton count={6} />
      ) : statsFetch.error ? (
        <ErrorState message={statsFetch.error} onRetry={statsFetch.refetch} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={statCards.total} icon={FileText} accent="slate" />
          <StatCard label="Non traités" value={statCards.nonTraites} icon={AlertTriangle} accent="amber" />
          <StatCard label="Critiques" value={statCards.critiques} icon={AlertOctagon} accent="red" />
          <StatCard label="En traitement" value={statCards.enTraitement} icon={Activity} accent="blue" />
          <StatCard label="Résolus" value={statCards.resolus} icon={CheckCircle2} accent="green" />
          <StatCard label="Non résolus" value={statCards.nonResolus} icon={XCircle} accent="red" />
        </div>
      )}

      {/* ── 4.2 — Critical-Now Hero Widget ─────────── */}
      {incidentsFetch.loading ? (
        <div className="h-24 animate-pulse rounded-xl border bg-muted/30" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={cn(
            'rounded-xl border p-4 mb-2',
            criticalIncidents.length > 0
              ? 'bg-rose-50 dark:bg-rose-950/40 border-l-4 border-l-rose-600 border border-rose-200 dark:border-rose-900'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500 border border-emerald-200 dark:border-emerald-900',
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            {criticalIncidents.length > 0 ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                </span>
                <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                  {criticalIncidents.length} incident{criticalIncidents.length > 1 ? 's' : ''} critique{criticalIncidents.length > 1 ? 's' : ''} en cours
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  Aucun incident critique en cours
                </span>
              </>
            )}
          </div>

          {criticalIncidents.length > 0 && (
            <div className="divide-y divide-rose-100 dark:divide-rose-900/50">
              {criticalIncidents.map((inc, idx) => (
                <CriticalBannerItem key={inc.id} incident={inc} index={idx} />
              ))}
            </div>
          )}

          {criticalIncidents.length === 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              Tous les incidents sont sous contrôle.
            </p>
          )}
        </motion.div>
      )}

      {/* ── 4.3 — Charts & Aging Table ─────────────── */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        {/* Left column — Charts */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 lg:overflow-visible lg:grid lg:grid-cols-2 lg:gap-4 lg:pb-0 scrollbar-thin">
          {/* Donut — Status distribution */}
          <Card className="min-w-[280px] snap-start lg:min-w-0 lg:col-span-1">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-semibold">Par statut</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {statsFetch.loading ? (
                <ChartBlockSkeleton />
              ) : !hasStatsData ? (
                <EmptyState
                  compact
                  icon={Inbox}
                  title="Aucun incident à afficher"
                  description="Les statistiques apparaîtront dès le premier incident déclaré."
                />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    {statusChartData.map((entry) => (
                      <span key={entry.name} className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}: {entry.value}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Bar — Department distribution */}
          <Card className="min-w-[280px] snap-start lg:min-w-0 lg:col-span-1">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-semibold">Par département</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {statsFetch.loading ? (
                <ChartBlockSkeleton />
              ) : deptChartData.length === 0 ? (
                <EmptyState
                  compact
                  icon={Inbox}
                  title="Aucune donnée disponible"
                />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={deptChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {deptChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Bar — Priority distribution */}
          <Card className="min-w-[280px] snap-start lg:min-w-0 lg:col-span-1">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-semibold">Par priorité</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {statsFetch.loading ? (
                <ChartBlockSkeleton />
              ) : priorityChartData.length === 0 ? (
                <EmptyState
                  compact
                  icon={Inbox}
                  title="Aucune donnée disponible"
                />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={priorityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {priorityChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* MTTR & Time-to-Claim metric cards */}
          <Card className="min-w-[200px] snap-start lg:min-w-0 lg:col-span-1">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-semibold">Métriques temps</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 border border-blue-100 dark:border-blue-900">
                <p className="text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Temps moyen de prise en charge
                </p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                  {incidentsFetch.loading ? '…' : fmtDuration(metrics.timeToClaim)}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-100 dark:border-emerald-900">
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  MTTR (Temps moyen de résolution)
                </p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {incidentsFetch.loading ? '…' : fmtDuration(metrics.mttr)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Aging Incidents Table + Activity Heatmap */}
        <div className="mt-6 lg:mt-0 space-y-6">
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-amber-500" />
                Incidents vieillissants (&gt; 2h)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {staleFetch.loading ? (
                <TableSkeleton rows={4} columns={4} />
              ) : staleFetch.error ? (
                <div className="p-4">
                  <ErrorState message={staleFetch.error} compact onRetry={staleFetch.refetch} />
                </div>
              ) : agingIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <ShieldCheck className="h-10 w-10 text-emerald-400 mb-3" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Aucun incident en retard
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tous les incidents sont traités dans les délais.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2.5">Référence</th>
                        <th className="px-4 py-2.5">Département</th>
                        <th className="px-4 py-2.5">Statut</th>
                        <th className="px-4 py-2.5">Temps en cours</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {agingIncidents.map((inc) => {
                        const isUrgent = (inc.claimedAt ?? inc.inProgressAt ?? inc.declaredAt)
                          ? Date.now() - new Date(inc.claimedAt ?? inc.inProgressAt ?? inc.declaredAt).getTime() > 4 * 60 * 60 * 1000
                          : false;
                        const cfg = getStatusConfig(inc.status);
                        return (
                          <tr
                            key={inc.id}
                            className={cn(
                              'transition-colors hover:bg-muted/50',
                              isUrgent && 'bg-red-50/50 dark:bg-red-950/20',
                            )}
                          >
                            <td className="px-4 py-3" style={{ boxShadow: `inset 3px 0 0 0 ${cfg.barColor}` }}>
                              <Link
                                href={`/admin/incidents/${inc.id}`}
                                onClick={startNavigation}
                                className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {inc.reference}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{inc.department}</td>
                            <td className="px-4 py-3">
                              <span className={cn('text-xs font-medium', cfg.textClass)}>
                                {cfg.labelFr}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  isUrgent
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400',
                                )}
                              >
                                {formatElapsed(inc.claimedAt ?? inc.inProgressAt ?? inc.declaredAt)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/admin/incidents/${inc.id}`}
                                onClick={startNavigation}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <ActivityHeatmap />
        </div>
      </div>

      {/* ── 4.5 — Recent Activity Panel ────────────── */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Activité récente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activityFetch.loading ? (
            <TableSkeleton rows={4} columns={3} />
          ) : activityFetch.error ? (
            <div className="p-4">
              <ErrorState message={activityFetch.error} compact onRetry={activityFetch.refetch} />
            </div>
          ) : !activityFetch.data || activityFetch.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Activity className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Aucune activité récente à afficher.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activityFetch.data.map((entry) => {
                const cfg = STATUS_ICONS[entry.currentStatus ?? ''] ?? STATUS_ICONS.DECLARED;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      cfg.iconClass,
                    )}>
                      <ActivityIcon status={entry.currentStatus} />
                    </div>
                    <p className="flex-1 text-sm text-foreground/80 truncate">
                      {activityText(entry)}
                    </p>
                    {entry.changedAt && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(entry.changedAt)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
