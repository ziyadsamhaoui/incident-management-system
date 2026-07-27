'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export default function RootPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // Route based on role to avoid access denied from ADMIN-only dashboard
    const { roles } = useAuthStore.getState();
    const userRole = roles?.[0]?.replace('ROLE_', '');
    if (userRole === 'ADMIN') router.replace('/dashboard');
    else if (userRole === 'CHEF_ATELIER') router.replace('/chef-atelier');
    else if (userRole === 'SOUS_CHEF') router.replace('/sous-chef');
    else router.replace('/dashboard');
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
