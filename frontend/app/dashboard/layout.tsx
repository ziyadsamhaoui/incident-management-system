'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Full command sidebar for ADMIN (desktop) */}
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} variant="admin" />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
            {children}
          </main>
        </div>

        {/* Mobile bottom tab navigation (< 768px) */}
        <MobileBottomNav />
      </div>
    </AuthGuard>
  );
}
