'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  BellRing,
  BellOff,
  CheckCheck,
  AlertTriangle,
  UserCheck,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useAsync } from '@/lib/use-async';
import { getMe } from '@/services/userService';
import { getAllNotifications, markNotificationAsRead } from '@/services/notificationService';
import type { NotificationDTO } from '@/types/notification';

// ── Notification icon/color maps ──────────────────

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  CRITICAL: AlertTriangle,
  CLAIM: UserCheck,
  PROGRESS: Activity,
  RESOLVE: CheckCircle2,
  CLOSE: XCircle,
  INFO: Bell,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  CLAIM: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  PROGRESS: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  RESOLVE: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  CLOSE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  INFO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function notifStyle(type: string) {
  const key = type?.toUpperCase() ?? 'INFO';
  return {
    icon: NOTIFICATION_ICONS[key] ?? Bell,
    color: NOTIFICATION_COLORS[key] ?? NOTIFICATION_COLORS.INFO,
  };
}

// ── Helpers ───────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'hier';
  return `il y a ${diffDays} jours`;
}

function notifTitle(n: NotificationDTO): string {
  const key = n.type?.toUpperCase() ?? 'INFO';
  if (key === 'CRITICAL') return 'Incident critique';
  if (key === 'CLAIM') return 'Incident pris en charge';
  if (key === 'PROGRESS') return 'Incident en cours de traitement';
  if (key === 'RESOLVE') return 'Incident résolu';
  if (key === 'CLOSE') return 'Incident clôturé';
  return 'Notification';
}

// ── List skeleton ─────────────────────────────────

function ListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-4 py-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────

export default function AdminNotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [localReadIds, setLocalReadIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // Current user id → notification history
  const { data: me } = useAsync(getMe, []);
  const meId = me?.id;

  const {
    data: page,
    loading,
    error,
    refetch,
    setData,
  } = useAsync(
    () => (meId != null ? getAllNotifications(meId, { page: 0, size: 50 }) : Promise.resolve(null)),
    [meId],
  );

  const notifications = useMemo(
    () => (page?.content ?? []).filter((n) => !localReadIds.has(n.id)),
    [page, localReadIds],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markOneRead = useCallback(
    async (id: number) => {
      try {
        await markNotificationAsRead(id);
      } catch {
        // Silently ignore — the item stays unread on next refetch
      }
      setLocalReadIds((prev) => new Set(prev).add(id));
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(unread.map((n) => markNotificationAsRead(n.id)));
      setLocalReadIds((prev) => {
        const next = new Set(Array.from(prev));
        unread.forEach((n) => next.add(n.id));
        return next;
      });
    } finally {
      setBusy(false);
    }
  }, [notifications]);

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="rounded-full px-2.5 text-xs font-semibold">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Restez informé des activités récentes
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={busy}
              className="gap-1.5 h-9"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Tout marquer comme lu</span>
              <span className="sm:hidden">Tout lu</span>
            </Button>
          )}
        </div>

        {/* Error banner */}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <div className="flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              Toutes
            </div>
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
              filter === 'unread'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Non lues
              {unreadCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Notification list */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <ListSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title={
                  filter === 'unread'
                    ? 'Aucune notification non lue'
                    : 'Aucune notification'
                }
                description={
                  filter === 'unread'
                    ? 'Vous avez lu toutes vos notifications.'
                    : 'Les notifications apparaîtront ici.'
                }
              />
            ) : (

              <div className="divide-y divide-border">
                {filtered.map((notif, idx) => {
                  const { icon: Icon, color } = notifStyle(notif.type);
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn(
                        'flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/30 cursor-pointer',
                        !notif.isRead && 'bg-primary/[0.02]',
                      )}
                      onClick={() => {
                        if (!notif.isRead) markOneRead(notif.id);
                      }}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          color,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            'text-sm truncate',
                            !notif.isRead ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                          )}>
                            {notifTitle(notif)}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(notif.createdAt)}
                            </span>
                            {!notif.isRead && (
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground/70 line-clamp-2">
                          {notif.message}
                        </p>
                        {notif.incidentReference && (
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
                            {notif.incidentReference}
                          </p>
                        )}
                      </div>
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
