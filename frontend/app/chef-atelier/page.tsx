'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  Plus,
  Search,
  SlidersHorizontal,
  FileText,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge } from '@/components/ui/badge';
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
import { StatusDotLabel, getStatusConfig } from '@/lib/constants/incidentStatus';
import { IncidentDetailDrawer } from '@/components/incidents/incident-detail-drawer';

// ── Types ─────────────────────────────────────────

interface IncidentRow {
  id: number;
  reference: string;
  declaredAt: string;
  category: string;
  status: string;
  claimedByFirstName: string | null;
  selected?: boolean;
}

// ── Mock data for demonstration ────────────────────

const MOCK_INCIDENTS: IncidentRow[] = [
  {
    id: 1,
    reference: 'INC-20260714-0001',
    declaredAt: '2026-07-14T08:23:15',
    category: 'Sécurité',
    status: 'DECLARED',
    claimedByFirstName: null,
  },
  {
    id: 2,
    reference: 'INC-20260714-0002',
    declaredAt: '2026-07-14T09:15:42',
    category: 'Accident',
    status: 'CLAIMED',
    claimedByFirstName: 'Ahmed',
  },
  {
    id: 3,
    reference: 'INC-20260714-0003',
    declaredAt: '2026-07-14T10:02:33',
    category: 'Réclamation',
    status: 'IN_PROGRESS',
    claimedByFirstName: 'Fatima',
  },
  {
    id: 4,
    reference: 'INC-20260714-0004',
    declaredAt: '2026-07-14T11:45:00',
    category: 'Sécurité',
    status: 'RESOLVED',
    claimedByFirstName: 'Mohamed',
  },
  {
    id: 5,
    reference: 'INC-20260714-0005',
    declaredAt: '2026-07-14T13:10:22',
    category: 'Accident',
    status: 'CLOSED',
    claimedByFirstName: 'Khadija',
  },
  {
    id: 6,
    reference: 'INC-20260714-0006',
    declaredAt: '2026-07-14T14:30:00',
    category: 'Réclamation',
    status: 'NON_RESOLVED',
    claimedByFirstName: null,
  },
  {
    id: 7,
    reference: 'INC-20260714-0007',
    declaredAt: '2026-07-14T15:00:10',
    category: 'Sécurité',
    status: 'DECLARED',
    claimedByFirstName: null,
  },
  {
    id: 8,
    reference: 'INC-20260714-0008',
    declaredAt: '2026-07-14T16:20:45',
    category: 'Accident',
    status: 'IN_PROGRESS',
    claimedByFirstName: 'Youssef',
  },
];

// ── Helpers ────────────────────────────────────────

const CATEGORIES = ['Sécurité', 'Accident', 'Réclamation', 'Mécanique', 'Électrique'];

// ── Stat Card ──────────────────────────────────────

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
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────

export default function MyIncidentsPage() {
  const { firstName, lastName, roles } = useAuthStore();

  // Welcome overlay
  const [showWelcome, setShowWelcome] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2100);
    return () => clearTimeout(timer);
  }, []);

  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Drawer state
  const [drawerIncidentId, setDrawerIncidentId] = useState<string | null>(null);

  // Stats
  const stats = {
    total: MOCK_INCIDENTS.length,
    open: MOCK_INCIDENTS.filter((i) => i.status === 'DECLARED').length,
    inProgress: MOCK_INCIDENTS.filter((i) => i.status === 'IN_PROGRESS').length,
    closed: MOCK_INCIDENTS.filter((i) => i.status === 'CLOSED').length,
  };

  const filteredIncidents = MOCK_INCIDENTS.filter((inc) => {
    if (searchQuery && !inc.reference.toLowerCase().includes(searchQuery.toLowerCase())) {
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

  const displayName =
    lastName && firstName ? `${lastName} ${firstName}` : firstName ?? 'Utilisateur';

  const primaryRole = (roles[0]?.replace('ROLE_', '') ?? 'CHEF_ATELIER') as string;

  return (
    <>
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
              <p className="mt-2 text-sm text-muted-foreground">
                Tableau de bord — Mes incidents déclarés
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {primaryRole === 'CHEF_ATELIER'
                    ? "Chef d'atelier"
                    : primaryRole === 'SOUS_CHEF'
                      ? 'Opérateur'
                      : primaryRole}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Chargement des données...
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Content ──────────────────────────── */}
      <div className="space-y-6">
        {/* ── Header ──────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consultez et gérez les incidents que vous avez déclarés
          </p>
        </div>

        {/* ── Statistics Grid ──────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Incidents" value={stats.total} icon={FileText} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Open Incidents" value={stats.open} icon={AlertTriangle} color="text-amber-600 dark:text-amber-400" />
          <StatCard label="In Progress" value={stats.inProgress} icon={Activity} color="text-violet-600 dark:text-violet-400" />
          <StatCard label="Closed Incidents" value={stats.closed} icon={CheckCircle2} color="text-emerald-600 dark:text-emerald-400" />
        </div>

        {/* ── Toolbar ──────────────────────────────── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by Incident ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DECLARED">Déclaré</SelectItem>
                <SelectItem value="CLAIMED">Pris en charge</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="RESOLVED">Résolu</SelectItem>
                <SelectItem value="NON_RESOLVED">Non résolu</SelectItem>
                <SelectItem value="CLOSED">Clôturé</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-10 gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">More Filters</span>
            </Button>
          </div>
        </div>

        {/* ── Incidents Table ──────────────────────── */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
              <table className="w-full min-w-[780px] lg:min-w-0 border-collapse">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                      />
                    </th>
                    <th className="px-3 py-3">Incident ID</th>
                    <th className="px-3 py-3">Date/Time</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3">Réclamé par</th>
                    <th className="w-16 px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Clock className="h-8 w-8 text-muted-foreground/50" />
                          <p>No incidents found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((inc) => {
                      const barClass = getStatusConfig(inc.status).barClass;
                      return (
                        <tr
                          key={inc.id}
                          className={cn(
                            'transition-colors hover:bg-muted/50',
                            'border-l-4',
                            barClass,
                            selectedIds.has(inc.id) && 'bg-primary/5',
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(inc.id)}
                              onChange={() => handleSelectOne(inc.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-sm font-medium">{inc.reference}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className="text-sm text-muted-foreground">
                              {formatDateTime(inc.declaredAt)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                              {inc.category}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusDotLabel status={inc.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            {inc.claimedByFirstName ? (
                              <span className="text-sm font-medium">{inc.claimedByFirstName}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground/60">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDrawerIncidentId(String(inc.id))}
                              className="h-7 gap-1.5 px-2 text-xs font-medium"
                              title="View incident details"
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
          </CardContent>
        </Card>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>{selectedIds.size} incident{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
        )}
      </div>

      <IncidentDetailDrawer
        incidentId={drawerIncidentId}
        onClose={() => setDrawerIncidentId(null)}
      />

      <div className="fixed bottom-6 right-6 z-30">
        <Button className="hidden h-12 gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl active:scale-95 lg:inline-flex">
          <Plus className="h-5 w-5" />
          Create Incident
        </Button>
        <Button
          size="icon"
          className="flex h-14 w-14 rounded-xl bg-blue-600 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl active:scale-95 lg:hidden"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Create Incident</span>
        </Button>
      </div>
    </>
  );
}
