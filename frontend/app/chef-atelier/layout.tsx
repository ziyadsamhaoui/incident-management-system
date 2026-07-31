'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuthGuard } from '@/components/auth/auth-guard';
import { NavigationProgressProvider } from '@/components/ui/navigation-progress';
import { useAuthStore } from '@/store/useAuthStore';

export default function ChefAtelierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { departmentId, hydrate } = useAuthStore();

  // Onboarding guard: redirect CHEF_ATELIER without department to onboarding
  useEffect(() => {
    hydrate();
    // Check is done client-side after hydration
    const stored = useAuthStore.getState();
    const role = stored.roles?.[0]?.replace('ROLE_', '');
    if (
      role === 'CHEF_ATELIER' &&
      !stored.departmentId &&
      typeof window !== 'undefined'
    ) {
      router.replace('/onboarding/department');
    }
  }, [departmentId, hydrate, router]);

  return (
    <AuthGuard allowedRoles={['CHEF_ATELIER']}>
      <NavigationProgressProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Scoped sidebar for CHEF_ATELIER */}
          <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} variant="chef-atelier" />

          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </NavigationProgressProvider>
    </AuthGuard>
  );
}
