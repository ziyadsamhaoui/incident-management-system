'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { Header } from '@/components/layout/header';
import { NavigationProgressProvider } from '@/components/ui/navigation-progress';

export default function ChefAtelierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['CHEF_ATELIER']}>
      <NavigationProgressProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-background">
          {/* TopNav only — no sidebar for CHEF_ATELIER */}
          <Header kiosk />

          {/* Main content — full viewport width */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </NavigationProgressProvider>
    </AuthGuard>
  );
}
