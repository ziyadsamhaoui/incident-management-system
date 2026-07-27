'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  Eye,
  FileText,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IncidentDetailDrawer } from '@/components/incidents/incident-detail-drawer';

// ── Types ─────────────────────────────────────────

interface IncidentRow {
  id: number;
  reference: string;
  declaredAt: string;
  category: string;
  status: string;
  priority: string;
}

// ── Mock data ─────────────────────────────────────

const MOCK_INCIDENTS: IncidentRow[] = [
  { id: 1, reference: 'INC-20260714-0001', declaredAt: '2026-07-14T08:23:15', category: 'Safety', status: 'DECLARED', priority: 'HIGH' },
  { id: 2, reference: 'INC-20260714-0002', declaredAt: '2026-07-14T09:15:42', category: 'Accident', status: 'CLAIMED', priority: 'CRITICAL' },
  { id: 3, reference: 'INC-20260714-0003', declaredAt: '2026-07-14T10:02:33', category: 'Complaint', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { id: 4, reference: 'INC-20260714-0004', declaredAt: '2026-07-14T11:45:00', category: 'Safety', status: 'RESOLVED', priority: 'LOW' },
  { id: 5, reference: 'INC-20260714-0005', declaredAt: '2026-07-14T13:10:22', category: 'Accident', status: 'CLOSED', priority: 'HIGH' },
  { id: 6, reference: 'INC-20260714-0006', declaredAt: '2026-07-14T14:30:00', category: 'Complaint', status: 'NON_RESOLVED', priority: 'MEDIUM' },
];

// ── Badge color maps (solid pill style) ──────────

const TYPE_COLORS: Record<string, string> = {
  Safety:    'bg-amber-500',
  Accident:  'bg-red-600',
  Complaint: 'bg-blue-600',
  Damage:    'bg-slate-800',
  Other:     'bg-slate-500',
};

const STATUS_COLORS: Record<string, string> = {
  DECLARED:     'bg-slate-900',
  CLAIMED:      'bg-blue-600',
  IN_PROGRESS:  'bg-violet-600',
  RESOLVED:     'bg-emerald-600',
  NON_RESOLVED: 'bg-red-600',
  CLOSED:       'bg-emerald-600',
};

const STATUS_LABELS: Record<string, string> = {
  DECLARED: 'New',
  CLAIMED: 'Under Review',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  NON_RESOLVED: 'Not Resolved',
  CLOSED: 'Closed',
};

const CATEGORIES = ['Safety', 'Accident', 'Complaint', 'Damage', 'Other'];

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW:      'bg-slate-500',
  MEDIUM:   'bg-amber-500',
  HIGH:     'bg-orange-600',
  CRITICAL: 'bg-red-600',
};

// ── Date formatting helpers ───────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Compact Stat Card ──────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
        <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

// ── Solid Pill Badge ───────────────────────────────

function PillBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white',
        color,
      )}
    >
      {label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────

export default function SousChefIncidentsPage() {
  const { firstName, lastName } = useAuthStore();

  // Welcome overlay state
  const [showWelcome, setShowWelcome] = useState(true);

  // Dismiss welcome after 2s + 0.6s fade
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Drawer state
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);

  // Derived data
  const stats = {
    total: MOCK_INCIDENTS.length,
    open: MOCK_INCIDENTS.filter((i) => i.status === 'DECLARED').length,
    inProgress: MOCK_INCIDENTS.filter((i) => i.status === 'IN_PROGRESS').length,
    closed: MOCK_INCIDENTS.filter((i) => i.status === 'CLOSED').length,
  };

  const filteredIncidents = MOCK_INCIDENTS.filter((inc) => {
    if (
      searchQuery &&
      !inc.reference.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && inc.category !== categoryFilter) return false;
    return true;
  });

  const allFilteredSelected =
    filteredIncidents.length > 0 &&
    filteredIncidents.every((inc) => selectedIds.has(inc.id));

  const handleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIncidents.map((inc) => inc.id)));
    }
  }, [allFilteredSelected, filteredIncidents]);

  const handleSelectOne = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Format name as [Last Name] [First Name] for welcome overlay
  const displayName =
    lastName && firstName ? `${lastName} ${firstName}` : firstName ?? 'Utilisateur';

  return (
    <div className="space-y-6">
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

      {/* ── Header ──────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes Incidents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultez vos incidents déclarés
        </p>
      </div>

      {/* ── Compact Statistics Grid ──────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Incidents" value={stats.total} icon={FileText} color="text-blue-600 dark:text-blue-400" />
        <StatCard label="Open Incidents" value={stats.open} icon={AlertTriangle} color="text-amber-600 dark:text-amber-400" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Activity} color="text-violet-600 dark:text-violet-400" />
        <StatCard label="Closed Incidents" value={stats.closed} icon={CheckCircle2} color="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* ── Card Wrapper ─────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800">
        {/* ── Filter Bar ──────────────────────────── */}
        <div className="border-b border-slate-200/80 pb-4 dark:border-slate-700/60">
          <div className="flex flex-col gap-3 rounded-xl bg-slate-100/70 p-3 dark:bg-slate-800/70 lg:flex-row lg:items-center">
            {/* Search — full width on MD/SM, fixed on LG+ */}
            <div className="relative w-full lg:w-56 lg:shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Incident ID or Employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full bg-white pl-9 dark:bg-slate-900"
              />
            </div>

            {/* Filters — stacked on MD/SM, inline on LG+ */}
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-[150px] bg-white dark:bg-slate-900">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DECLARED">New</SelectItem>
                  <SelectItem value="CLAIMED">Under Review</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="NON_RESOLVED">Not Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>

              {/* Type filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-[150px] bg-white dark:bg-slate-900">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* More Filters button — icon only on MD/SM, text on LG+ */}
              <Button variant="outline" size="sm" className="h-10 gap-2 bg-white dark:bg-slate-900">
                <Filter className="h-4 w-4" />
                <span className="hidden lg:inline">More Filters</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Incidents Table ──────────────────────── */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          <table className="w-full min-w-[780px] lg:min-w-0">
            <thead>
              <tr className="border-b border-slate-200/80 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground dark:border-slate-700/60">
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                  />
                </th>
                <th className="px-4 py-3.5">Incident ID</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Time</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Priority</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="w-24 px-4 py-3.5 text-center"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {filteredIncidents.length === 0 ? (
                <tr>                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 text-muted-foreground/50" />
                      <p>No incidents found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => {
                  const typeColor = TYPE_COLORS[inc.category] ?? 'bg-slate-500';
                  const statusColor = STATUS_COLORS[inc.status] ?? 'bg-slate-500';
                  const statusLabel = STATUS_LABELS[inc.status] ?? inc.status;

                  return (
                    <tr
                      key={inc.id}
                      className={cn(
                        'transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30',
                        selectedIds.has(inc.id) && 'bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(inc.id)}
                          onChange={() => handleSelectOne(inc.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDrawerIncidentId(String(inc.id))}
                          className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {inc.reference}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm text-foreground">{formatDate(inc.declaredAt)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm text-muted-foreground">{formatTime(inc.declaredAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <PillBadge label={inc.category} color={typeColor} />
                      </td>
                      <td className="px-4 py-3">
                        <PillBadge label={PRIORITY_LABELS[inc.priority] ?? inc.priority} color={PRIORITY_COLORS[inc.priority] ?? 'bg-slate-500'} />
                      </td>
                      <td className="px-4 py-3">
                        <PillBadge label={statusLabel} color={statusColor} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDrawerIncidentId(String(inc.id))}
                          className="h-8 gap-1.5 px-2 text-xs font-medium"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer — selection count ───────── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 border-t border-slate-200/80 px-4 py-3 text-sm text-muted-foreground dark:border-slate-700/60">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>
              {selectedIds.size} incident{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>
        )}
      </div>

      {/* ── Drawer ──────────────────────────────── */}
      <IncidentDetailDrawer
        incidentId={drawerIncidentId}
        onClose={() => setDrawerIncidentId(null)}
      />

      {/* ── Floating Action Button ─────────────────── */}
      <div className="fixed bottom-6 right-6 z-30">
        {/* Expanded LG+ */}
        <Button className="hidden h-14 gap-2.5 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl active:scale-95 lg:inline-flex">
          <Plus className="h-5 w-5" />
          Declare Incident
        </Button>

        {/* Compact MD/SM */}
        <Button
          size="icon"
          className="flex h-14 w-14 rounded-xl bg-blue-600 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl active:scale-95 lg:hidden"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Declare Incident</span>
        </Button>
      </div>
    </div>
  );
}
