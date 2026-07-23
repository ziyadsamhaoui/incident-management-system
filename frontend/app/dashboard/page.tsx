'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText } from 'lucide-react';
import type { UserRole } from '@/types/auth';

const roleLabel: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  CHEF_ATELIER: 'Floor Supervisor',
  SOUS_CHEF: 'Floor Operator',
};

export default function DashboardPage() {
  const { firstName, lastName, matricule, lane, roles } = useAuthStore();
  const primaryRole = (roles[0]?.replace('ROLE_', '') ?? lane) as UserRole;

  const stats = [
    { label: 'Total Incidents', value: '—', icon: FileText, color: 'text-blue-600' },
    { label: 'Open', value: '—', icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'In Progress', value: '—', icon: Activity, color: 'text-violet-600' },
    { label: 'Resolved', value: '—', icon: CheckCircle2, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Matricule <span className="font-mono font-medium">{matricule}</span>
          {' · '}
          <Badge variant={primaryRole.toLowerCase() as any} className="capitalize">
            {roleLabel[primaryRole] ?? primaryRole}
          </Badge>
        </p>
      </div>

      {/* Statistics cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Incident data will appear here once the backend is connected.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              This dashboard will auto-refresh with real-time statistics.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
