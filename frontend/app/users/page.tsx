'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Search,
  Users,
  Shield,
  Clock,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Mock Data ─────────────────────────────────────

interface MockUser {
  id: number;
  firstName: string;
  lastName: string;
  matricule: string;
  role: 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';
  department: string;
  status: 'active' | 'pending_approval' | 'pending_activation';
  claimed: boolean;
}

const MOCK_USERS: MockUser[] = [
  { id: 1, firstName: 'Ahmed', lastName: 'Amraoui', matricule: '1005', role: 'CHEF_ATELIER', department: 'Assemblage', status: 'active', claimed: true },
  { id: 2, firstName: 'Fatima', lastName: 'Zahra', matricule: '1042', role: 'CHEF_ATELIER', department: 'Peinture', status: 'pending_approval', claimed: true },
  { id: 3, firstName: 'Youssef', lastName: 'El Amrani', matricule: '1085', role: 'SOUS_CHEF', department: 'Usinage', status: 'active', claimed: true },
  { id: 4, firstName: 'Mohammed', lastName: 'Alaoui', matricule: '1078', role: 'SOUS_CHEF', department: 'Logistique', status: 'active', claimed: true },
  { id: 5, firstName: 'Khadija', lastName: 'Bennani', matricule: '1102', role: 'CHEF_ATELIER', department: 'Soudure', status: 'pending_activation', claimed: false },
  { id: 6, firstName: 'Hassan', lastName: 'Ouazzani', matricule: '1125', role: 'SOUS_CHEF', department: 'Assemblage', status: 'active', claimed: true },
  { id: 7, firstName: 'Nadia', lastName: 'Fassi', matricule: '1141', role: 'CHEF_ATELIER', department: 'Usinage', status: 'pending_approval', claimed: true },
  { id: 8, firstName: 'Omar', lastName: 'Bennis', matricule: '1158', role: 'SOUS_CHEF', department: 'Peinture', status: 'active', claimed: true },
];

// ── Pending Request Card ──────────────────────────

function PendingRequestCard({
  user,
  onApprove,
  onReject,
}: {
  user: MockUser;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            #{user.matricule} · {user.department}
            <span className="mx-1">·</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              Promotion Chef d&apos;atelier
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onReject(user.id)}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <XCircle className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => onApprove(user.id)}
          className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approuver
        </Button>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SOUS_CHEF: 'Opérateur',
  CHEF_ATELIER: "Chef d'atelier",
  ADMIN: 'Administrateur',
};

const ROLE_COLORS: Record<string, string> = {
  SOUS_CHEF: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CHEF_ATELIER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function UsersPage() {
  const router = useRouter();
  const [users] = useState(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const pendingUsers = users.filter(
    (u) => u.status === 'pending_approval' || u.status === 'pending_activation',
  );

  const handleApprove = (id: number) => {
    console.log('Approve user', id);
    // TODO: API call
  };

  const handleReject = (id: number) => {
    console.log('Reject user', id);
    // TODO: API call
  };

  const filteredUsers = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !u.firstName.toLowerCase().includes(q) &&
        !u.lastName.toLowerCase().includes(q) &&
        !u.matricule.includes(q)
      )
        return false;
    }
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </button>

        {/* Header with actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gérer les comptes opérateurs et chefs d&apos;atelier
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.97]"
          >
            <UserPlus className="h-4 w-4" />
            + Nouvel Utilisateur
          </button>
        </div>

        {/* Pending Queue */}
        {pendingUsers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Demandes en attente ({pendingUsers.length})
              </span>
            </div>
            <div className="space-y-2">
              {pendingUsers.map((user) => (
                <PendingRequestCard
                  key={user.id}
                  user={user}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou matricule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 w-[180px]">
              <SelectValue placeholder="Tous les rôles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="SOUS_CHEF">Opérateurs</SelectItem>
              <SelectItem value="CHEF_ATELIER">Chefs d'atelier</SelectItem>
              <SelectItem value="ADMIN">Administrateurs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table (desktop) / Card List (mobile) */}
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Matricule</th>
                    <th className="px-4 py-3">Nom complet</th>
                    <th className="px-4 py-3">Rôle</th>
                    <th className="px-4 py-3">Département</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium">#{user.matricule}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">
                            {user.firstName} {user.lastName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', ROLE_COLORS[user.role])}>
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.department}</td>
                        <td className="px-4 py-3">
                          {user.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                              <Clock className="h-3 w-3" />
                              En attente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      ROLE_COLORS[user.role],
                    )}>
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{user.matricule} · {user.department}
                      </p>
                    </div>
                    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium', ROLE_COLORS[user.role])}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
