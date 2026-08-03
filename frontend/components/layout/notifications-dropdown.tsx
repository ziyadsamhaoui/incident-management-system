'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import {
  Bell,
  BellRing,
  BellOff,
  CheckCheck,
  Loader2,
  ChevronRight,
  AlertTriangle,
  UserCheck,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/lib/use-async';
import { getMe } from '@/services/userService';
import { getAllNotifications, markNotificationAsRead } from '@/services/notificationService';
import type { NotificationDTO } from '@/types/notification';

// ── Notification icon/color maps (mirrors the notifications page) ──

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

// ── Component ─────────────────────────────────────

export function NotificationsDropdown() {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [localReadIds, setLocalReadIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: me } = useAsync(getMe, []);
  const meId = me?.id;

  const { data: page, loading, error, refetch } = useAsync(
    () => (meId != null ? getAllNotifications(meId, { page: 0, size: 30 }) : Promise.resolve(null)),
    [meId],
  );

  const notifications = useMemo(
    () => (page?.content ?? []).filter((n) => !localReadIds.has(n.id)),
    [page, localReadIds],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markOneRead = useCallback(async (id: number) => {
    try {
      await markNotificationAsRead(id);
    } catch {
      // Silently ignore — the item stays unread on next refetch
    }
    setLocalReadIds((prev) => new Set(prev).add(id));
  }, []);

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
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refetch();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px] text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        forceMount
        className="w-[min(92vw,380px)] border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl shadow-black/50"
      >
        {/* Header — title left, mark-all-as-read right */}
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Tout marquer comme lu
            </button>
          )}
        </div>

        {/* Read / unread tabs — left aligned */}
        <div className="flex items-center gap-1.5 px-4 pb-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
          >
            <span className="flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              Toutes
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter === 'unread'
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
          >
            <span className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Non lues
              {unreadCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </span>
          </button>
        </div>

        <DropdownMenuSeparator className="bg-slate-800" />

        {/* List */}
        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              Impossible de charger les notifications.
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff className="h-6 w-6 text-slate-600" />
              <p className="text-xs text-slate-400">
                {filter === 'unread'
                  ? 'Aucune notification non lue'
                  : 'Aucune notification'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filtered.map((notif) => {
                const { icon: Icon, color } = notifStyle(notif.type);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      // Always mark as read when clicked
                      if (!notif.isRead) markOneRead(notif.id);
                      // Navigate to the linked incident detail when available
                      if (notif.incidentId != null) {
                        setOpen(false);
                        startNavigation();
                        router.push(`/admin/incidents/${notif.incidentId}`);
                      }
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/60',
                      !notif.isRead && 'bg-blue-950/20',
                    )}
                  >
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn(
                          'truncate text-xs',
                          !notif.isRead ? 'font-semibold text-slate-100' : 'font-medium text-slate-400',
                        )}>
                          {notifTitle(notif)}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400/80">
                        {notif.message}
                      </p>
                      {notif.incidentReference && (
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                          {notif.incidentReference}
                        </p>
                      )}
                    </div>
                    {!notif.isRead && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="bg-slate-800" />

        {/* Footer — full page (DropdownMenuItem auto-closes the menu on click) */}
        <DropdownMenuItem asChild className="focus:bg-slate-800 focus:text-slate-100">
          <Link
            href="/admin/notifications"
            className="flex items-center justify-between px-2 py-2 text-xs font-medium text-slate-300 hover:text-slate-100"
          >
            Voir toutes les notifications
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
