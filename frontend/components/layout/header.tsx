'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  LogOut,
  Search,
  Command,
  ChevronDown,
  User,
  Settings,
  Shield,
} from 'lucide-react';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationsDropdown } from '@/components/layout/notifications-dropdown';
import { useAuthStore } from '@/store/useAuthStore';
import { logout as logoutApi } from '@/services/authService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ── Route → Breadcrumb label map ─────────────────

const BREADCRUMB_LABELS: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/incidents': 'Incidents',
  '/users': 'Utilisateurs',
  '/admin/reference': 'Données de référence',
  '/admin/subscriptions': 'Mes abonnements',
  '/admin/settings': 'Paramètres',
  '/settings': 'Paramètres',
};

// ── Props ─────────────────────────────────────────

interface HeaderProps {
  onToggleSidebar?: () => void;
  /** If true, render the kiosk variant (SOUS_CHEF) with prominent CTA and no sidebar toggle */
  kiosk?: boolean;
  /** Override breadcrumb label (e.g., from mobile nav) */
  breadcrumbOverride?: string | null;
}

export function Header({ onToggleSidebar, kiosk = false, breadcrumbOverride }: HeaderProps) {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const pathname = usePathname();
  const {
    firstName,
    lastName,
    matricule,
    departmentName,
    roles,
    logout: clearSession,
  } = useAuthStore();

  const primaryRole = roles[0]?.replace('ROLE_', '') ?? 'CHEF_ATELIER';
  const initials = (firstName?.[0] ?? '') + (lastName?.[0] ?? '');
  const safeMatricule = matricule && matricule > 0 ? String(matricule) : 'ADM-0001';
  const displayName = firstName
    ? `${firstName} ${lastName ?? ''}`.trim()
    : `User #${safeMatricule}`;

  // ── Dynamic breadcrumb ───────────────────────────
  const breadcrumb = useMemo(() => {
    if (breadcrumbOverride) return breadcrumbOverride;
    // Try exact match first, then prefix match
    if (BREADCRUMB_LABELS[pathname]) return BREADCRUMB_LABELS[pathname];
    // Match prefix routes like /admin/reference/categories/something
    const prefix = Object.keys(BREADCRUMB_LABELS).find(
      (key) => pathname.startsWith(key + '/') || pathname === key
    );
    return prefix ? BREADCRUMB_LABELS[prefix] : 'Incidents';
  }, [pathname, breadcrumbOverride]);

  // Cmd+K search state (admin only)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = primaryRole === 'ADMIN';

  const handleLogout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Even if the API call fails, clear the local session
    }
    clearSession();
    router.replace('/login');
  }, [clearSession, router]);

  // Cmd+K global key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isAdmin) {
          setSearchOpen((prev) => !prev);
        }
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, searchOpen]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const roleLabel =
    primaryRole === 'ADMIN'
      ? 'Administrateur'
      : primaryRole === 'CHEF_ATELIER'
        ? "Chef d'atelier"
        : 'Opérateur';

  return (
    <>
      <header
        className={cn(
          // Dark slate header bar — stays above slide-over drawers
          'flex h-16 items-center justify-between px-4',
          'bg-slate-900 border-b border-slate-800 text-slate-100',
          'relative z-10',
          kiosk && 'shadow-sm',
        )}
      >
        {/* ── Left side: Search bar (admin only, furthest left) ──── */}
        <div className="flex items-center gap-3 flex-1">
          {/* Mobile sidebar toggle (hidden in kiosk mode) */}
          {!kiosk && onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              onClick={onToggleSidebar}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          )}

          {/* Admin search trigger — far left, wider (hidden below lg) */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:flex h-9 gap-2 text-slate-400 border-slate-700 hover:text-slate-100 hover:border-slate-600 lg:min-w-[280px] xl:min-w-[400px] 2xl:min-w-[480px] justify-between"
              onClick={() => setSearchOpen(true)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="h-4 w-4 shrink-0" />
                <span className="text-xs truncate">Rechercher un incident...</span>
              </span>
              <kbd className="pointer-events-none inline-flex h-5 shrink-0 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                <Command className="h-2.5 w-2.5" />
                K
              </kbd>
            </Button>
          )}
        </div>

        {/* ── Right side: actions + user ───────────── */}
        <div className="flex items-center gap-2">
          {/* Mobile search icon — visible below lg */}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-400 hover:text-slate-100 hover:bg-slate-800 min-w-[44px] min-h-[44px]"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Rechercher</span>
            </Button>
          )}

          {/* Notification bell — admin only, header version is hidden below lg (the
              mobile bottom bar hosts the notifications sheet on non-large displays) */}
          {isAdmin && (
            <div className="hidden lg:block">
              <NotificationsDropdown />
            </div>
          )}

          {/* ── User Profile Dropdown ────────────────── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative min-w-[44px] min-h-[44px] gap-2 rounded-full px-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    className={cn(
                      'text-xs font-bold',
                      isAdmin
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-blue-600 text-white',
                    )}
                  >
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                {/* Full name — restored on lg+ */}
                <span className="hidden lg:inline text-sm font-medium">
                  {displayName}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-500 lg:inline-block" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-72 border-slate-800 bg-slate-900 text-slate-100 shadow-2xl shadow-black/50"
              align="end"
              forceMount
            >
              {/* ── Header Section: Large Avatar + Name + Role ───── */}
              <DropdownMenuLabel className="font-normal p-4">
                <div className="flex items-center gap-4">
                  {/* Large avatar */}
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className={cn(
                        'text-lg font-bold',
                        isAdmin
                          ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-blue-600 text-white',
                      )}
                    >
                      {initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-slate-100">
                      {displayName}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border',
                        primaryRole === 'ADMIN'
                          ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                          : primaryRole === 'CHEF_ATELIER'
                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                            : 'bg-slate-500/10 border-slate-500/25 text-slate-400',
                      )}
                    >
                      <Shield className="h-3 w-3" />
                      <span className="font-semibold">{roleLabel}</span>
                      <span className="opacity-50">·</span>
                      <span className="font-mono">#{safeMatricule}</span>
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>

              {/* ── Metadata Section ──────────────────── */}
              <div className="px-4 pb-2">
                <div className="rounded-lg bg-slate-800/50 px-3 py-2 border border-slate-700/50">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Département
                  </p>
                  <p className="text-sm font-medium text-slate-200 mt-0.5">
                    {departmentName ?? 'Non assigné'}
                  </p>
                </div>
              </div>

              <DropdownMenuSeparator className="bg-slate-800" />

              {/* ── Action Menu Links ─────────────────── */}
              <div className="p-1.5">
                <DropdownMenuItem
                  onClick={() => {
                    startNavigation();
                    if (isAdmin) router.push('/admin/settings');
                    else if (primaryRole === 'CHEF_ATELIER') router.push('/chef-atelier/settings');
                    else router.push('/sous-chef/settings');
                  }}
                  className="cursor-pointer rounded-md text-slate-300 hover:text-slate-100 hover:bg-slate-800 focus:bg-slate-800 focus:text-slate-100"
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="bg-slate-800" />

              {/* ── Logout ─────────────────────────────── */}
              <div className="p-1.5">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Se déconnecter
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Cmd+K Search Modal (Admin only) ─────────── */}
      {searchOpen && isAdmin && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] sm:items-center sm:pt-0">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          />
          <div className="relative z-10 w-full max-w-xl mx-4 sm:mx-6 lg:max-w-2xl xl:max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par référence d'incident ou matricule..."
                className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <kbd className="hidden shrink-0 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-flex">
                ESC
              </kbd>
            </div>
            <div className="p-12 text-center text-sm text-slate-500">
              {searchQuery ? (
                <p>Recherche de &quot;{searchQuery}&quot;...</p>
              ) : (
                <p> Tapez une référence d&apos;incident ou un matricule pour rechercher</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
