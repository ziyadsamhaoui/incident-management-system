'use client';

import { useMemo, useState } from 'react';
import {
  Search,
  Users,
  Clock,
  CheckCircle2,
  UserPlus,
  Loader2,
  AlertTriangle,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAsync, extractErrorMessage } from '@/lib/use-async';
import { getUsers, createUser, promoteUser, deactivateUser } from '@/services/userService';
import { getDepartments } from '@/services/referenceService';
import type { UserResponseDTO, CreateUserRequestDTO } from '@/types/user';

// ── Labels ────────────────────────────────────────

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

// ── Create User Modal ─────────────────────────────

function CreateUserModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [matricule, setMatricule] = useState('');
  const [role, setRole] = useState<'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN'>('SOUS_CHEF');
  const [departmentId, setDepartmentId] = useState<string>('none');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: departments } = useAsync(getDepartments, []);

  const isValid =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    matricule.trim() !== '' &&
    password.trim() !== '' &&
    !Number.isNaN(Number(matricule));

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    const payload: CreateUserRequestDTO = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
      matricule: Number(matricule),
      role,
      departmentId: departmentId === 'none' ? null : Number(departmentId),
    };
    try {
      await createUser(payload);
      onOpenChange(false);
      setFirstName('');
      setLastName('');
      setMatricule('');
      setPassword('');
      setRole('SOUS_CHEF');
      setDepartmentId('none');
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel utilisateur</DialogTitle>
          <DialogDescription>
            Créez un compte opérateur, chef d&apos;atelier ou administrateur.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-user-firstname">Prénom</Label>
              <Input
                id="new-user-firstname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ahmed"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-lastname">Nom</Label>
              <Input
                id="new-user-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Amraoui"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-user-matricule">Matricule</Label>
              <Input
                id="new-user-matricule"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="1005"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN')}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOUS_CHEF">Opérateur</SelectItem>
                  <SelectItem value="CHEF_ATELIER">Chef d'atelier</SelectItem>
                  <SelectItem value="ADMIN">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Département</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {(departments ?? []).map((dept) => (
                  <SelectItem key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Mot de passe initial</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer l&apos;utilisateur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Table Skeleton ────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserResponseDTO | null>(null);

  const { data, loading, error, refetch } = useAsync(
    () => getUsers({ page: 0, size: 100 }),
    [],
  );

  const users = useMemo(() => data?.content ?? [], [data]);

  const filteredUsers = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !u.firstName.toLowerCase().includes(q) &&
        !u.lastName.toLowerCase().includes(q) &&
        !String(u.matricule).includes(q)
      )
        return false;
    }
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    return true;
  });

  // Admin promotes a SOUS_CHEF directly — no request/approval workflow.
  const handlePromote = async (id: number) => {
    setBusyId(id);
    setActionError(null);
    try {
      await promoteUser(id);
      refetch();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  // Returns true when the deactivation succeeded (used to keep the
  // confirmation dialog open on failure so the admin can retry).
  const handleDeactivate = async (id: number): Promise<boolean> => {
    setBusyId(id);
    setActionError(null);
    try {
      await deactivateUser(id);
      refetch();
      return true;
    } catch (err) {
      setActionError(extractErrorMessage(err));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  // Confirmed from the dialog — run the API call, close it only on success.
  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    const ok = await handleDeactivate(deactivateTarget.id);
    if (ok) setDeactivateTarget(null);
  };

  const canPromote = (u: UserResponseDTO) => u.role === 'SOUS_CHEF' && u.isActive;
  const canDeactivate = (u: UserResponseDTO) => u.role !== 'ADMIN' && u.isActive;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
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
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.97]"
          >
            <UserPlus className="h-4 w-4" />
            + Nouvel Utilisateur
          </button>
          <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} onCreated={refetch} />
        </div>

        {/* Error banner */}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {actionError && (
          <ErrorState message={actionError} compact onRetry={() => setActionError(null)} />
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
            {loading ? (
              <TableSkeleton />
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun utilisateur enregistré."
                description={
                  search || roleFilter !== 'all'
                    ? 'Aucun résultat ne correspond à vos filtres actuels.'
                    : 'Créez votre premier compte pour commencer.'
                }
                actionLabel={search || roleFilter !== 'all' ? 'Effacer les filtres' : '+ Nouvel utilisateur'}
                onAction={() => {
                  if (search || roleFilter !== 'all') {
                    setSearch('');
                    setRoleFilter('all');
                  } else {
                    setCreateOpen(true);
                  }
                }}
              />
            ) : (
              <>
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
                        <th className="px-4 py-3 w-44">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.map((user) => (
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
                          <td className="px-4 py-3 text-muted-foreground">
                            {user.department?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            {user.isActive ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                <Clock className="h-3 w-3" />
                                Désactivé
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {canPromote(user) && (
                                <button
                                  type="button"
                                  disabled={busyId === user.id}
                                  onClick={() => handlePromote(user.id)}
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                                  title="Promouvoir au rôle Chef d'atelier"
                                >
                                  {busyId === user.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <UserCheck className="h-3 w-3" />
                                  )}
                                  Promouvoir
                                </button>
                              )}
                              {canDeactivate(user) && (
                                <button
                                  type="button"
                                  disabled={busyId === user.id}
                                  onClick={() => setDeactivateTarget(user)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                                  title="Désactiver le compte"
                                >
                                  {busyId === user.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
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
                            #{user.matricule} · {user.department?.name ?? 'Non assigné'}
                          </p>
                        </div>
                        <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium', ROLE_COLORS[user.role])}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        {canPromote(user) && (
                          <button
                            type="button"
                            disabled={busyId === user.id}
                            onClick={() => handlePromote(user.id)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                          >
                            {busyId === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <UserCheck className="h-3 w-3" />
                            )}
                            Promouvoir
                          </button>
                        )}
                        {canDeactivate(user) && (
                          <button
                            type="button"
                            disabled={busyId === user.id}
                            onClick={() => setDeactivateTarget(user)}
                            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                          >
                            {busyId === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Désactiver
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Deactivate confirmation dialog */}
        <Dialog open={deactivateTarget !== null} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Désactiver le compte ?</DialogTitle>
              <DialogDescription>
                Le compte de{' '}
                <span className="font-semibold text-foreground">
                  {deactivateTarget?.firstName} {deactivateTarget?.lastName}
                </span>{' '}
                (<span className="font-mono">#{deactivateTarget?.matricule}</span>) sera désactivé
                et ne pourra plus se connecter. Cette action peut être annulée par un
                administrateur.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivateTarget !== null && busyId === deactivateTarget.id}
              >
                Annuler
              </Button>
              <Button
                onClick={confirmDeactivate}
                disabled={deactivateTarget !== null && busyId === deactivateTarget.id}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              >
                {deactivateTarget !== null && busyId === deactivateTarget.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Désactiver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
