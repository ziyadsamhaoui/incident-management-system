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
} from 'lucide-react';

// ── Navigation items with role restrictions ──────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** If set, only users with at least one of these roles can see this item. */
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Incidents', href: '/incidents', icon: FileWarning },
  { label: 'My Incidents', href: '/incidents/mine', icon: ClipboardList, roles: ['SOUS_CHEF', 'CHEF_ATELIER'] },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'User Management', href: '/users', icon: Users, roles: ['ADMIN'] },
  { label: 'Admin Settings', href: '/admin', icon: Settings, roles: ['ADMIN'] },
  { label: 'Reference Data', href: '/admin/reference', icon: Building2, roles: ['ADMIN'] },
];

// ── Sidebar component ────────────────────────────

interface SidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const roles = useAuthStore((s) => s.roles);
  const [collapsed, setCollapsed] = useState(false);
  const mobileOpen = open ?? false;
  const setMobileOpen = onOpenChange ?? (() => {});

  const userRoles = roles.map((r) => r.replace('ROLE_', '') as UserRole);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((r) => userRoles.includes(r));
  });

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
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                I
              </div>
              <span className="text-sm font-semibold">ICGLMA IMS</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
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
          <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 hover:bg-muted md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
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
