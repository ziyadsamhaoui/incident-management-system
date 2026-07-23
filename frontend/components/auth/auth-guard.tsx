'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/types/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  /** If specified, only users with at least one of these roles can access the content. */
  allowedRoles?: UserRole[];
  /** Optional fallback UI shown while checking auth state (avoids flash of login page). */
  fallback?: React.ReactNode;
}

/**
 * Client-side route guard.
 * Redirects unauthenticated users to `/login` and optionally filters by role.
 */
export function AuthGuard({
  children,
  allowedRoles,
  fallback,
}: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, roles, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, hydrate, router]);

  if (!isAuthenticated) {
    return fallback ?? (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = roles.map((r) => r.replace('ROLE_', '') as UserRole);
    const hasAccess = userRoles.some((r) => allowedRoles.includes(r));
    if (!hasAccess) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
          <p className="text-muted-foreground">
            You do not have permission to view this page.
          </p>
          <button
            className="text-sm text-primary hover:underline"
            onClick={() => router.push('/dashboard')}
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
}
