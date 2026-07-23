'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User } from 'lucide-react';
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

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const { firstName, lastName, matricule, roles, logout: clearSession } = useAuthStore();

  const initials = (firstName?.[0] ?? '') + (lastName?.[0] ?? '');
  const displayName = firstName ? `${firstName} ${lastName ?? ''}`.trim() : `User #${matricule}`;

  const handleLogout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Even if the API call fails, clear the local session
    }
    clearSession();
    router.replace('/login');
  }, [clearSession, router]);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 gap-2 rounded-full px-2">
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
                <p className="text-xs leading-none text-muted-foreground">
                  #{matricule} · {roles[0]?.replace('ROLE_', '') ?? 'N/A'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
