'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  LogOut,
  Bell,
  Search,
  Command,
  ChevronDown,
  User,
  Settings,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

interface HeaderProps {
  onToggleSidebar?: () => void;
  /** If true, render the kiosk variant (SOUS_CHEF) with prominent CTA and no sidebar toggle */
  kiosk?: boolean;
}

export function Header({ onToggleSidebar, kiosk = false }: HeaderProps) {
  const router = useRouter();
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
  const displayName = firstName
    ? `${firstName} ${lastName ?? ''}`.trim()
    : `User #${matricule}`;

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

  const roleMatriculeLabel =
    primaryRole === 'ADMIN' ? `Admin · #${matricule}` : `Opérateur · #${matricule}`;

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
        {/* ── Left side: Branding ──────────────────── */}
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle (hidden in kiosk mode) */}
          {!kiosk && onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              onClick={onToggleSidebar}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          )}

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            {/* IC logo badge */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-sm">
              IC
            </div>
            {/* Title */}
            <span className="font-bold text-lg tracking-tight text-white">
              ICGLMA
            </span>
            {/* Divider + sub-label */}
            <span className="hidden sm:inline text-xs text-slate-400 border-l border-slate-700 pl-2.5 ml-0.5">
              Incidents
            </span>
          </div>
        </div>

        {/* ── Right side: actions + user ───────────── */}
        <div className="flex items-center gap-2">
          {/* Admin Cmd+K search trigger */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 text-slate-400 border-slate-700 hover:text-slate-100 hover:border-slate-600 sm:inline-flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="text-xs">Search...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                <Command className="h-2.5 w-2.5" />
                K
              </kbd>
            </Button>
          )}

          {/* Notification bell */}
          <Button
            variant="ghost"
            size="icon"
            className="relative text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="sr-only">Notifications</span>
          </Button>

          {/* ── User Profile Dropdown ────────────────── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 gap-2 rounded-full px-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-blue-600 text-xs font-bold text-white">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">
                  {displayName}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-500 sm:inline-block" />
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
                    <AvatarFallback className="bg-blue-600 text-lg font-bold text-white">
                      {initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-slate-100">
                      {displayName}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center border border-blue-500/30 rounded-md px-2.5 py-0.5 text-xs font-medium',
                        'bg-blue-500/15 text-blue-400',
                      )}
                    >
                      {roleMatriculeLabel}
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
                  onClick={() => router.push('/settings')}
                  className="cursor-pointer rounded-md text-slate-300 hover:text-slate-100 hover:bg-slate-800 focus:bg-slate-800 focus:text-slate-100"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Profil / Paramètres
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
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Incident Reference or User Matricule..."
                className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <kbd className="hidden shrink-0 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-flex">
                ESC
              </kbd>
            </div>
            <div className="p-12 text-center text-sm text-slate-500">
              {searchQuery ? (
                <p>Searching for &quot;{searchQuery}&quot;...</p>
              ) : (
                <p>Type an Incident Reference or User Matricule to search</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
