'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/types/auth';
import {
  LayoutDashboard,
  FileWarning,
  Users,
  Settings,
  Bell,
  ClipboardList,
  X,
  Building2,
  ChevronLeft,
  ChevronDown,
  User,
  Bookmark,
  Circle,
} from 'lucide-react';

// ── Navigation item types ─────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** If set, only users with at least one of these roles can see this item. */
  roles?: UserRole[];
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

const ADMIN_ITEMS: NavEntry[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { label: 'Incidents', href: '/incidents', icon: FileWarning, roles: ['ADMIN'] },
  { label: 'Users', href: '/users', icon: Users, roles: ['ADMIN'] },
  {
    label: 'Reference Data',
    icon: Building2,
    roles: ['ADMIN'],
    children: [
      { label: 'Categories', href: '/admin/reference/categories', icon: Circle },
      { label: 'Departments', href: '/admin/reference/departments', icon: Circle },
      { label: 'Sections', href: '/admin/reference/sections', icon: Circle },
      { label: 'Production Lines', href: '/admin/reference/production-lines', icon: Circle },
      { label: 'Stations', href: '/admin/reference/stations', icon: Circle },
    ],
  } as NavGroup,
  { label: 'My Subscriptions', href: '/admin/subscriptions', icon: Bookmark, roles: ['ADMIN'] },
  { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['ADMIN'] },
];

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

// ── Sidebar component ────────────────────────────

export function Sidebar({ open, onOpenChange, variant = 'chef-atelier' }: SidebarProps) {
  const pathname = usePathname();
  const roles = useAuthStore((s) => s.roles);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Reference Data']));
  const mobileOpen = open ?? false;
  const setMobileOpen = onOpenChange ?? (() => {});

  const userRoles = roles.map((r) => r.replace('ROLE_', '') as UserRole);

  // Pick nav items based on variant
  const navEntries: NavEntry[] =
    variant === 'admin' ? ADMIN_ITEMS : CHEF_ATELIER_ITEMS;

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

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
        <div className="flex h-14 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link href={brandHref(userRoles)} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                I
              </div>
              <span className="text-sm font-semibold">ICGLMA IMS</span>
            </Link>
          )}
          {collapsed && (
            <Link
              href={brandHref(userRoles)}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            >
              I
            </Link>
          )}
          <button
            onClick={() => {
              setCollapsed(!collapsed);
              setMobileOpen(false);
            }}
            className="hidden rounded-md p-1 hover:bg-muted md:block"
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                collapsed && 'rotate-180',
              )}
            />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 hover:bg-muted md:hidden"
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
                            onClick={() => setMobileOpen(false)}
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
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{entry.label}</span>}
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
