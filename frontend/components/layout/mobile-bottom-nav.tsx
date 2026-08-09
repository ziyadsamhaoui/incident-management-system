'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  MoreHorizontal,
  X,
  Building2,
  BellRing,
  Bell,
  Settings,
  ChevronDown,
  Circle,
  Archive,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NotificationsSheet } from '@/components/layout/notifications-dropdown';

// ── Tab definitions ──────────────────────────────

interface TabItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Optional dot badge color */
  dotColor?: string;
}

const BOTTOM_TABS: TabItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Incidents', href: '/admin/incidents', icon: AlertTriangle, dotColor: 'bg-rose-500' },
  { label: 'Users', href: '/users', icon: Users, dotColor: 'bg-amber-500' },
  { label: 'Notifs', href: '#notifications', icon: Bell },
  { label: 'Plus', href: '#more', icon: MoreHorizontal },
];

// ── Props ─────────────────────────────────────────

interface MobileBottomNavProps {
  isVisible?: boolean;
  onNavigate?: (href: string) => void;
}

// ── Component ─────────────────────────────────────

export function MobileBottomNav({ isVisible = true, onNavigate }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [refDataExpanded, setRefDataExpanded] = useState(false);

  const activeTab = useMemo(() => {
    // Find exact or prefix match
    for (const tab of BOTTOM_TABS) {
      if (tab.href === '#more' || tab.href === '#notifications') continue;
      if (pathname === tab.href || pathname.startsWith(tab.href + '/')) {
        return tab.href;
      }
    }
    return '/dashboard';
  }, [pathname]);

  const handleTabClick = (href: string) => {
    if (href === '#more') {
      setMoreOpen(true);
      return;
    }
    if (href === '#notifications') {
      setNotifOpen(true);
      return;
    }
    onNavigate?.(href);
    startNavigation();
    router.push(href);
  };

  // More sheet navigation items
  const secondaryRoutes = [
    {
      label: 'Reference Data',
      icon: Building2,
      children: [
        { label: 'Categories', href: '/admin/reference?tab=categories' },
        { label: 'Departments', href: '/admin/reference?tab=departments' },
        { label: 'Sections', href: '/admin/reference?tab=sections' },
        { label: 'Production Lines', href: '/admin/reference?tab=production-lines' },
        { label: 'Stations', href: '/admin/reference?tab=stations' },
      ],
    },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Archives', href: '/admin/incidents/logs', icon: Archive },
    { label: 'My Subscriptions', href: '/admin/subscriptions', icon: BellRing },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  if (!isVisible) return null;

  return (
    <>
      {/* ── Bottom Tab Bar (visible below lg — small & medium displays) ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800 flex items-center justify-around h-16 lg:hidden">
        {BOTTOM_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.href === '#more' ? moreOpen : activeTab === tab.href;

          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => handleTabClick(tab.href)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0',
                'transition-colors duration-150',
                isActive
                  ? 'text-blue-400'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {tab.dotColor && (
                  <span
                    className={cn(
                      'absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full',
                      tab.dotColor,
                    )}
                  />
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── "More" Bottom Sheet ──────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="more-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 z-[70] bg-slate-900 border-t border-slate-800 rounded-t-2xl max-h-[70vh] overflow-y-auto lg:hidden"
            >
              {/* Handle */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                <span className="text-sm font-semibold text-slate-200">
                  Navigation
                </span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 space-y-1">
                {secondaryRoutes.map((route) => {
                  if ('children' in route && route.children) {
                    // Accordion group
                    return (
                      <div key={route.label}>
                        <button
                          type="button"
                          onClick={() => setRefDataExpanded(!refDataExpanded)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                        >
                          <route.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-left">{route.label}</span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform',
                              refDataExpanded && 'rotate-180',
                            )}
                          />
                        </button>

                        <AnimatePresence>
                          {refDataExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-3 border-l border-slate-700 pl-3 space-y-0.5 py-1">
                                {route.children.map((child) => (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    onClick={() => {
                                      setMoreOpen(false);
                                      onNavigate?.(child.href);
                                      startNavigation();
                                    }}
                                    className={cn(
                                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                      pathname === child.href || pathname.startsWith(child.href + '/')
                                        ? 'bg-blue-600/10 text-blue-400'
                                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800',
                                    )}
                                  >
                                    <Circle className="h-3 w-3 shrink-0" />
                                    <span>{child.label}</span>
                                  </Link>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  // Plain item
                  const Icon = route.icon!;
                  const isRouteActive =
                    pathname === route.href || pathname.startsWith(route.href + '/');

                  return (
                    <Link
                      key={route.href}
                      href={route.href!}
                      onClick={() => {
                        setMoreOpen(false);
                        onNavigate?.(route.href!);
                        startNavigation();
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isRouteActive
                          ? 'bg-blue-600/10 text-blue-400'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{route.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Notifications sheet (small & medium displays) ── */}
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
