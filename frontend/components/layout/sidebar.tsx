'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useAsync } from '@/lib/use-async';
import { getIncidents } from '@/services/incidentService';
import type { UserRole } from '@/types/auth';
import {
  LayoutDashboard,
  Flame,
  Users,
  Settings,
  Bell,
  ClipboardList,
  X,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Bookmark,
  Folder,
  Grid3x3,
  Cable,
  Cpu,
} from 'lucide-react';

// ── Badge hook for attention counts (real API data, ADMIN only) ──

function useAttentionBadges(isAdmin: boolean) {
  // Critical open incidents
  const { data: incidents } = useAsync(
    () =>
      isAdmin
        ? getIncidents({ status: 'DECLARED', page: 0, size: 100 })
        : Promise.resolve(null),
    [isAdmin],
  );
  const criticalIncidents = useMemo(
    () => (incidents?.content ?? []).filter((i) => i.priority === 'CRITICAL').length,
    [incidents],
  );

  return { criticalIncidents };
}

// ── Navigation item types ─────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** If set, only users with at least one of these roles can see this item. */
  roles?: UserRole[];
  /** Optional count badge */
  badge?: number | null;
  /** Optional badge color class */
  badgeClass?: string;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

// ── Role-specific navigation definitions ─────────

const CHEF_ATELIER_ITEMS: NavEntry[] = [
  { label: 'Incidents', href: '/chef-atelier', icon: ClipboardList, roles: ['CHEF_ATELIER'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['CHEF_ATELIER'] },
  { label: 'Profile', href: '/profile', icon: User, roles: ['CHEF_ATELIER'] },
];

function buildAdminItems(criticalIncidents: number): NavEntry[] {
  return [
    { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
    {
      label: 'Incidents',
      href: '/admin/incidents',
      icon: Flame,
      roles: ['ADMIN'],
      badge: criticalIncidents > 0 ? criticalIncidents : null,
      badgeClass: 'bg-rose-600 text-white',
    },
    {
      label: 'Utilisateurs',
      href: '/users',
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      label: 'Données de référence',
      icon: Building2,
      roles: ['ADMIN'],
      children: [
        { label: 'Catégories', href: '/admin/reference?tab=categories', icon: Folder },
        { label: 'Départements', href: '/admin/reference?tab=departments', icon: Building2 },
        { label: 'Sections', href: '/admin/reference?tab=sections', icon: Grid3x3 },
        { label: 'Lignes de production', href: '/admin/reference?tab=production-lines', icon: Cable },
        { label: 'Stations', href: '/admin/reference?tab=stations', icon: Cpu },
      ],
    } as NavGroup,
    { label: 'Mes abonnements', href: '/admin/subscriptions', icon: Bookmark, roles: ['ADMIN'] },
    { label: 'Paramètres', href: '/admin/settings', icon: Settings, roles: ['ADMIN'] },
  ];
}

// ── Props ─────────────────────────────────────────

interface SidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** If true, render the CHEF_ATELIER scoped nav. Otherwise render the ADMIN full nav. */
  variant?: 'chef-atelier' | 'admin';
}

// ── Brand href per role ──────────────────────────

function brandHref(userRoles: UserRole[]): string {
  if (userRoles.includes('ADMIN')) return '/dashboard';
  if (userRoles.includes('CHEF_ATELIER')) return '/chef-atelier';
  return '/sous-chef';
}

// ── localStorage helper for group expansion ──────

function getStoredExpandedGroups(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem('admin_sidebar_refdata_expanded');
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // ignore
  }
  return new Set(); // Default: collapsed
}

function storeExpandedGroups(groups: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      'admin_sidebar_refdata_expanded',
      JSON.stringify(Array.from(groups)),
    );
  } catch {
    // ignore
  }
}

// ── Sidebar component ────────────────────────────

export function Sidebar({ open, onOpenChange, variant = 'chef-atelier' }: SidebarProps) {
  const pathname = usePathname();
  const { startNavigation } = useNavigationProgress();
  const roles = useAuthStore((s) => s.roles);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(getStoredExpandedGroups);
  const userRoles = roles.map((r) => r.replace('ROLE_', '') as UserRole);
  const isAdmin = userRoles.includes('ADMIN');
  const { criticalIncidents } = useAttentionBadges(isAdmin);

  const mobileOpen = open ?? false;
  const setMobileOpen = onOpenChange ?? (() => {});

  // Pick nav items based on variant
  const navEntries: NavEntry[] =
    variant === 'admin'
      ? buildAdminItems(criticalIncidents)
      : CHEF_ATELIER_ITEMS;

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      storeExpandedGroups(next);
      return next;
    });
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col border-r bg-background transition-all duration-300 md:static md:z-auto',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Brand header */}
        <div className={cn('flex h-14 items-center justify-between border-b', collapsed ? 'px-1.5' : 'px-4')}>
          {!collapsed && (
            <Link href={brandHref(userRoles)} onClick={startNavigation} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                IC
              </div>
              <span className="text-sm font-semibold">ICGLMA</span>
            </Link>
          )}
          {collapsed && (
            <Link
              href={brandHref(userRoles)}
              onClick={startNavigation}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground shrink-0"
            >
              IC
            </Link>
          )}
          {/* Collapse chevron — desktop only (≥768px) */}
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              setMobileOpen(false);
            }}
            className={cn(
              'rounded-md hover:bg-muted items-center justify-center',
              collapsed ? 'hidden md:flex h-6 w-6' : 'hidden md:flex h-6 w-6',
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          {/* Close button — mobile only (<768px) */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden rounded-md p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navEntries.map((entry) => {
            if (isGroup(entry)) {
              const isExpanded = expandedGroups.has(entry.label);
              const GroupIcon = entry.icon;

              return (
                <div key={entry.label} className="space-y-1">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(entry.label)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <GroupIcon className="h-5 w-5 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{entry.label}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            isExpanded && 'rotate-180',
                          )}
                        />
                      </>
                    )}
                  </button>

                  {/* Children — only visible when expanded */}
                  {!collapsed && isExpanded && (
                    <div className="ml-3 space-y-0.5 border-l pl-3">
                      {entry.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isActive =
                          pathname === child.href ||
                          pathname.startsWith(child.href + '/');

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                            onClick={() => {
                              setMobileOpen(false);
                              startNavigation();
                            }}
                          >
                            <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Plain nav item
            const Icon = entry.icon;
            const isActive =
              pathname === entry.href || pathname.startsWith(entry.href + '/');

            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-semibold border-r-2 border-blue-600'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => {
                  setMobileOpen(false);
                  startNavigation();
                }}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{entry.label}</span>
                )}
                {!collapsed && entry.badge != null && (
                  <span
                    className={cn(
                      'rounded-full text-xs px-2 py-0.5 font-bold',
                      entry.badgeClass ?? 'bg-primary text-primary-foreground',
                    )}
                  >
                    {entry.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t p-4 text-xs text-muted-foreground">
            Incident Management v0.1
          </div>
        )}
      </aside>
    </>
  );
}
