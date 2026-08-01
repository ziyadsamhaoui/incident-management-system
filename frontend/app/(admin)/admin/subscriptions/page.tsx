'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BellRing,
  Bell,
  BellOff,
  Building2,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAsync } from '@/lib/use-async';
import { getMe } from '@/services/userService';
import { getDepartments } from '@/services/referenceService';
import {
  getSubscribedDepartments,
  subscribeToDepartment,
  unsubscribeFromDepartment,
} from '@/services/subscriptionService';

// ── Page ──────────────────────────────────────────

export default function AdminSubscriptionsPage() {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Current admin user
  const { data: me } = useAsync(getMe, []);
  const meId = me?.id;

  // All departments + current subscriptions
  const { data: departments, loading: depsLoading, error: depsError, refetch: refetchDeps } =
    useAsync(getDepartments, []);
  const {
    data: subscribed,
    loading: subsLoading,
    error: subsError,
    refetch: refetchSubs,
  } = useAsync(
    () => (meId != null ? getSubscribedDepartments(meId) : Promise.resolve([])),
    [meId],
  );

  const subscribedIds = useMemo(
    () => new Set((subscribed ?? []).map((d) => d.id)),
    [subscribed],
  );

  const loading = depsLoading || subsLoading || meId == null;
  const error = depsError ?? subsError;

  const toggleSubscription = async (id: number) => {
    if (meId == null) return;
    setBusyId(id);
    setSaveError(null);
    const wasSubscribed = subscribedIds.has(id);
    try {
      if (wasSubscribed) {
        await unsubscribeFromDepartment(meId, id);
      } else {
        await subscribeToDepartment(meId, id);
      }
      refetchSubs();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setSaveError(anyErr?.response?.data?.message ?? anyErr?.message ?? 'Échec de la mise à jour.');
    } finally {
      setBusyId(null);
    }
  };

  const subscribedCount = subscribedIds.size;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mes abonnements</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gérez vos alertes de notification par département
            </p>
          </div>
          <Button
            onClick={refetchDeps}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Save className="h-4 w-4" />
            Actualiser
          </Button>
        </div>

        {/* Error banner */}
        {error && <ErrorState message={error} onRetry={() => { refetchDeps(); refetchSubs(); }} />}
        {saveError && <ErrorState message={saveError} compact onRetry={() => setSaveError(null)} />}

        {/* Summary pill */}
        {!loading && !error && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm">
            <BellRing className="h-4 w-4 text-blue-500" />
            <span className="font-medium">
              Vous êtes abonné à{' '}
              <span className="text-blue-600 dark:text-blue-400">{subscribedCount}</span>{' '}
              département{subscribedCount > 1 ? 's' : ''} sur {departments?.length ?? 0}
            </span>
          </div>
        )}

        {/* Subscription list */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-semibold">Départements</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : !departments || departments.length === 0 ? (
              <EmptyState
                compact
                icon={Building2}
                title="Aucun département disponible."
                description="Les départements configurés apparaîtront ici."
              />
            ) : (
              <div className="divide-y divide-border">
                {departments.map((dept, idx) => {
                  const isSubscribed = subscribedIds.has(dept.id);
                  return (
                    <motion.div
                      key={dept.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                          isSubscribed
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                        )}>
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {dept.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isSubscribed ? 'Notifications activées' : 'Notifications désactivées'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === dept.id}
                        onClick={() => toggleSubscription(dept.id)}
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                          busyId === dept.id && 'opacity-60',
                          isSubscribed
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
                        )}
                      >
                        {busyId === dept.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isSubscribed ? (
                          <Bell className="h-4 w-4" />
                        ) : (
                          <BellOff className="h-4 w-4" />
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
