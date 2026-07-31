'use client';

import { useState, useMemo } from 'react';
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
  Clock,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ── Mock Notifications ────────────────────────────

interface NotificationItem {
  id: string;
  type: 'critical' | 'claim' | 'progress' | 'resolve' | 'close' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  claim: UserCheck,
  progress: Activity,
  resolve: CheckCircle2,
  close: XCircle,
  info: Bell,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  claim: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  progress: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  resolve: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  close: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  info: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', type: 'critical', title: 'Incident critique déclaré', message: 'INC-20260730-0001 - Détecteur de fumée déclenché sans cause identifiée (Assemblage)', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), read: false },
  { id: 'n2', type: 'claim', title: 'Incident pris en charge', message: 'INC-20260730-0002 pris en charge par Ahmed Bennani (Usinage)', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), read: false },
  { id: 'n3', type: 'progress', title: 'Incident en cours de traitement', message: 'INC-20260730-0003 est maintenant en cours (Peinture)', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), read: true },
  { id: 'n4', type: 'resolve', title: 'Incident résolu', message: 'INC-20260729-0004 a été résolu par Admin', timestamp: new Date(Date.now() - 240 * 60000).toISOString(), read: true },
  { id: 'n5', type: 'info', title: 'Nouvel utilisateur inscrit', message: 'Ahmed Amraoui (#1005) a rejoint le département Assemblage', timestamp: new Date(Date.now() - 360 * 60000).toISOString(), read: true },
  { id: 'n6', type: 'critical', title: 'Incident critique non résolu', message: 'INC-20260728-0002 toujours non résolu après 24h (Usinage)', timestamp: new Date(Date.now() - 1440 * 60000).toISOString(), read: false },
  { id: 'n7', type: 'close', title: 'Incident clôturé automatiquement', message: 'INC-20260726-0001 clôturé après résolution (Soudure)', timestamp: new Date(Date.now() - 2880 * 60000).toISOString(), read: true },
];

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

// ── Page ──────────────────────────────────────────

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications;
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

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
              className="gap-1.5 h-9"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tout marquer comme lu</span>
              <span className="sm:hidden">Tout lu</span>
            </Button>
          )}
        </div>

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
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BellOff className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-base font-semibold text-muted-foreground">
                  {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground/60">
                  {filter === 'unread'
                    ? 'Vous avez lu toutes vos notifications.'
                    : 'Les notifications apparaîtront ici.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((notif, idx) => {
                  const Icon = NOTIFICATION_ICONS[notif.type] ?? Bell;
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn(
                        'flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/30 cursor-pointer',
                        !notif.read && 'bg-primary/[0.02]',
                      )}
                      onClick={() => markOneRead(notif.id)}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          NOTIFICATION_COLORS[notif.type],
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            'text-sm truncate',
                            !notif.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                          )}>
                            {notif.title}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(notif.timestamp)}
                            </span>
                            {!notif.read && (
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground/70 line-clamp-2">
                          {notif.message}
                        </p>
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
