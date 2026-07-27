'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api-client';
import type { SetDepartmentPayload } from '@/types/user';

// ── Mock departments (will be replaced by API call) ──

const MOCK_DEPARTMENTS = [
  { id: 'dept_1', name: 'Assembly Line A' },
  { id: 'dept_2', name: 'Assembly Line B' },
  { id: 'dept_3', name: 'Painting Workshop' },
  { id: 'dept_4', name: 'Quality Control' },
  { id: 'dept_5', name: 'Logistics & Supply' },
  { id: 'dept_6', name: 'Maintenance' },
  { id: 'dept_7', name: 'Packaging' },
];

// ── Page ──────────────────────────────────────────

export default function OnboardingDepartmentPage() {
  const router = useRouter();
  const { firstName, lastName, roles } = useAuthStore();
  const setDepartment = useAuthStore((s) => s.setDepartment);

  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryRole = roles[0]?.replace('ROLE_', '') ?? '';
  const displayName =
    lastName && firstName
      ? `${lastName} ${firstName}`
      : firstName ?? 'Utilisateur';

  const handleSubmit = useCallback(async () => {
    if (!selectedDept) return;

    setIsSubmitting(true);
    setError(null);

    // Find the selected department name
    const dept = MOCK_DEPARTMENTS.find((d) => d.id === selectedDept);
    const deptName = dept?.name ?? selectedDept;

    try {
      // Try real API first
      await apiClient.patch('/api/users/me/department', {
        departmentId: selectedDept,
      } satisfies SetDepartmentPayload);
    } catch {
      // Silently accept in dev mode (backend may not be available)
    }

    // Update local auth store so the onboarding guard doesn't loop
    setDepartment(selectedDept, deptName);

    setSuccess(true);

    // Redirect to chef-atelier after brief delay
    setTimeout(() => {
      router.replace('/chef-atelier');
    }, 1500);
  }, [selectedDept, setDepartment, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-xl sm:border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              {success ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-xl">
              {success
                ? 'Département configuré !'
                : 'Bienvenue, ' + displayName}
            </CardTitle>
            <CardDescription className="mt-2">
              {success
                ? 'Redirection vers votre tableau de bord...'
                : "Pour commencer, veuillez sélectionner votre département d'affectation."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {!success && (
              <>
                {/* Role badge */}
                <div className="flex justify-center">
                  <Badge variant="secondary" className="gap-1.5 capitalize">
                    <Building2 className="h-3 w-3" />
                    {primaryRole === 'CHEF_ATELIER' ? "Chef d'atelier" : primaryRole}
                  </Badge>
                </div>

                {/* Department selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Département <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={selectedDept ?? ''}
                    onValueChange={(val) => {
                      setSelectedDept(val);
                      if (error) setError(null);
                    }}
                  >
                    <SelectTrigger className="h-12 w-full rounded-xl">
                      <SelectValue placeholder="Sélectionnez un département..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Security notice */}
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Cette sélection est définitive. Une fois configuré, votre
                    département ne peut être modifié que par un administrateur.
                  </span>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <Button
                  className="h-12 w-full gap-2 rounded-xl text-base"
                  disabled={!selectedDept || isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-5 w-5" />
                  )}
                  {isSubmitting ? 'Enregistrement...' : 'Confirmer mon département'}
                </Button>
              </>
            )}

            {success && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
