'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  LogOut,
  Bell,
  Search,
  Command,
  User,
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

  // Focus search input when opened
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
          'flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60',
          kiosk && 'bg-primary/5 shadow-sm',
        )}
      >
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle (hidden in kiosk mode) */}
          {!kiosk && onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onToggleSidebar}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          )}

          {/* Kiosk brand (SOUS_CHEF) — no title, just the header */}
          {kiosk && <div />}
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Cmd+K search trigger */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 text-muted-foreground sm:inline-flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="text-xs">Search...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <Command className="h-2.5 w-2.5" />
                K
              </kbd>
            </Button>
          )}



          {/* Notification bell */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
            <span className="sr-only">Notifications</span>
          </Button>

          {/* User profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 gap-2 rounded-full px-2"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">
                  {displayName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="flex items-center gap-1 text-xs leading-none text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    {roleLabel} · #{matricule}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push('/profile')}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Cmd+K Search Modal (Admin only) ─────────── */}
      {searchOpen && isAdmin && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          />

          {/* Search panel */}
          <div className="relative z-10 w-full max-w-xl rounded-xl border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Incident Reference or User Matricule..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="hidden shrink-0 items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
                ESC
              </kbd>
            </div>

            {/* Results placeholder */}
            <div className="p-12 text-center text-sm text-muted-foreground">
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
