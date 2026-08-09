'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  LogOut,
  Search,
  Command,
  ChevronDown,
  User,
  Shield,
  Bell,
} from 'lucide-react';
import { useNavigationProgress } from '@/components/ui/navigation-progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  NotificationsPanelContent,
  useNotificationsData,
} from '@/components/layout/notifications-dropdown';
import { useAuthStore } from '@/store/useAuthStore';
import { logout as logoutApi } from '@/services/authService';
import { cn } from '@/lib/utils';

// ── Route → Breadcrumb label map ─────────────────

const BREADCRUMB_LABELS: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/analytics': 'Analytique',
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

  // ── Header panels (notifications + profile) ─────────────────────
  // Both panels render BELOW the navbar (y-axis) as an absolutely positioned
  // overlay — they never shift the page layout (the previous in-flow sub-bar
  // pushed content down every time a panel opened).
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifData = useNotificationsData(isAdmin);

  const closePanels = useCallback(() => {
    setProfileOpen(false);
    setNotifOpen(false);
  }, []);

  // Dismiss panels on outside click, Escape, or route change.
  const headerRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!headerRootRef.current?.contains(e.target as Node)) closePanels();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closePanels();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closePanels]);

  useEffect(() => {
    closePanels();
  }, [pathname, closePanels]);

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
          if (!searchOpen) closePanels();
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
  }, [isAdmin, searchOpen, closePanels]);

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

  const openNotifications = () => {
    setProfileOpen(false);
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) notifData.refetch();
  };

  const openProfile = () => {
    setNotifOpen(false);
    setProfileOpen(!profileOpen);
  };

  const openSearch = () => {
    closePanels();
    setSearchOpen(true);
  };

  const goToSettings = () => {
    closePanels();
    startNavigation();
    if (isAdmin) router.push('/admin/settings');
    else if (primaryRole === 'CHEF_ATELIER') router.push('/chef-atelier/settings');
    else router.push('/sous-chef/settings');
  };

  const panelOpen = profileOpen || notifOpen;

  return (
    <>
      <div ref={headerRootRef} className="relative z-10">
      {/* ── Navbar — follows the light/dark theme (white ↔ slate-900) ── */}
      <header
        className={cn(
          'flex h-16 items-center justify-between px-4',
          'bg-white border-b border-slate-200 text-slate-900',
          'dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100',
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
              className="lg:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
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
              className="hidden lg:flex h-9 gap-2 text-slate-500 border-slate-200 hover:text-slate-900 hover:border-slate-300 dark:text-slate-400 dark:border-slate-700 dark:hover:text-slate-100 dark:hover:border-slate-600 lg:min-w-[280px] xl:min-w-[400px] 2xl:min-w-[480px] justify-between"
              onClick={openSearch}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="h-4 w-4 shrink-0" />
                <span className="text-xs truncate">Rechercher un incident...</span>
              </span>
              <kbd className="pointer-events-none inline-flex h-5 shrink-0 select-none items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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
              className="lg:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-w-[44px] min-h-[44px] dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
              onClick={openSearch}
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Rechercher</span>
            </Button>
          )}

          {/* Notification bell — admin only, header version is hidden below lg (the
              mobile bottom bar hosts the notifications sheet on non-large displays) */}
          {isAdmin && (
            <div className="hidden lg:block">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                aria-haspopup="menu"
                className="relative min-h-[44px] min-w-[44px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={openNotifications}
              >
                <Bell className="h-5 w-5" />
                {notifData.unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {notifData.unreadCount > 9 ? '9+' : notifData.unreadCount}
                  </span>
                )}
              </Button>
            </div>
          )}

          {/* ── User Profile Trigger ────────────────── */}
          <Button
            variant="ghost"
            aria-label="Profil"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="relative min-w-[44px] min-h-[44px] gap-2 rounded-full px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={openProfile}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback
                className={cn(
                  'text-xs font-bold',
                  isAdmin
                    ? 'bg-blue-600/15 text-blue-600 border border-blue-500/30 dark:bg-blue-950 dark:text-blue-300'
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
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 lg:inline-block dark:text-slate-500" />
          </Button>
        </div>
      </header>

      {/* ── Panel overlay — sits directly under the navbar on the y-axis but
            absolutely positioned, so opening it never shifts the page layout
            (it floats above the top of the page content instead) ──────── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="header-subbar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full z-20 overflow-hidden border-b border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30"
          >
            <div className="flex justify-end gap-3 px-4 py-3">
              {/* ── Notifications panel ─────────────── */}
              {notifOpen && (
                <div className="w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:shadow-black/40">
                  <NotificationsPanelContent data={notifData} onItemClick={closePanels} />
                </div>
              )}

              {/* ── User Profile panel ──────────────── */}
              {profileOpen && (
                <div className="w-72 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:shadow-black/40">
                  {/* Header Section: Large Avatar + Name + Role */}
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback
                          className={cn(
                            'text-lg font-bold',
                            isAdmin
                              ? 'bg-blue-600/15 text-blue-600 border border-blue-500/30 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-blue-600 text-white',
                          )}
                        >
                          {initials || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="truncate text-base font-semibold">
                          {displayName}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border',
                            primaryRole === 'ADMIN'
                              ? 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400'
                              : primaryRole === 'CHEF_ATELIER'
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
                                : 'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-400',
                          )}
                        >
                          <Shield className="h-3 w-3" />
                          <span className="font-semibold">{roleLabel}</span>
                          <span className="opacity-50">·</span>
                          <span className="font-mono">#{safeMatricule}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Section */}
                  <div className="px-4 pb-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Département
                      </p>
                      <p className="text-sm font-medium text-slate-700 mt-0.5 dark:text-slate-200">
                        {departmentName ?? 'Non assigné'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800" />

                  {/* Action Menu Links */}
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={goToSettings}
                      className="flex w-full cursor-pointer items-center rounded-md px-2 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </button>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800" />

                  {/* Logout */}
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center rounded-md px-2 py-2 text-sm text-red-600 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* ── Cmd+K Search Modal (Admin only) — rendered at the layout top
            level (outside the z-10 wrapper) so its z-[200] stays above the
            mobile sidebar drawer (z-50) and bottom nav (z-40) ── */}
      {searchOpen && isAdmin && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] sm:items-center sm:pt-0">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          />
          <div className="relative z-10 w-full max-w-xl mx-4 sm:mx-6 lg:max-w-2xl xl:max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <Search className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par référence d'incident ou matricule..."
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <kbd className="hidden shrink-0 items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                ESC
              </kbd>
            </div>
            <div className="p-12 text-center text-sm text-slate-400 dark:text-slate-500">
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
