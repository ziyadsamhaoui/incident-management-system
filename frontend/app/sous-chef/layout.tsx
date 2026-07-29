'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { Header } from '@/components/layout/header';

export default function SousChefLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['SOUS_CHEF']}>
      <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/60">
        {/* Kiosk TopNav — no sidebar, prominent CTA */}
        <Header kiosk />

        {/* Main content — full viewport width */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
