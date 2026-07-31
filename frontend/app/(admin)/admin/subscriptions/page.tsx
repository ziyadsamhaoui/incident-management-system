'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BellRing,
  Bell,
  BellOff,
  Building2,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ── Mock Data ─────────────────────────────────────

interface DepartmentSubscription {
  id: string;
  name: string;
  subscribed: boolean;
}

const INITIAL_SUBSCRIPTIONS: DepartmentSubscription[] = [
  { id: '1', name: 'Assemblage', subscribed: true },
  { id: '2', name: 'Usinage', subscribed: true },
  { id: '3', name: 'Peinture', subscribed: false },
  { id: '4', name: 'Soudure', subscribed: true },
  { id: '5', name: 'Logistique', subscribed: false },
  { id: '6', name: 'Contrôle qualité', subscribed: false },
  { id: '7', name: 'Maintenance', subscribed: true },
];

// ── Page ──────────────────────────────────────────

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(INITIAL_SUBSCRIPTIONS);
  const [saved, setSaved] = useState(false);

  const toggleSubscription = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === id ? { ...sub, subscribed: !sub.subscribed } : sub,
      ),
    );
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // TODO: API call to save preferences
  };

  const subscribedCount = subscriptions.filter((s) => s.subscribed).length;

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
            onClick={handleSave}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Save className="h-4 w-4" />
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </Button>
        </div>

        {/* Summary pill */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm">
          <BellRing className="h-4 w-4 text-blue-500" />
          <span className="font-medium">
            Vous êtes abonné à <span className="text-blue-600 dark:text-blue-400">{subscribedCount}</span> département{subscribedCount > 1 ? 's' : ''} sur {subscriptions.length}
          </span>
        </div>

        {/* Subscription list */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-semibold">Départements</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y divide-border">
              {subscriptions.map((sub, idx) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      sub.subscribed
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
                    )}>
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {sub.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sub.subscribed ? 'Notifications activées' : 'Notifications désactivées'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSubscription(sub.id)}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                      sub.subscribed
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700',
                    )}
                  >
                    {sub.subscribed ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
