'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IncidentDetailContent } from '@/components/incidents/incident-detail-content';
import { useAsync } from '@/lib/use-async';
import { getIncidentDetail } from '@/services/incidentService';
import type { IncidentDetailDTO } from '@/types/incident';

// ── Page ──────────────────────────────────────────

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id as string;

  const { data: incident, loading, error, refetch } = useAsync<IncidentDetailDTO>(
    () => getIncidentDetail(incidentId),
    [incidentId],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de l'incident...</p>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold">Erreur</h2>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {error ?? "Impossible de charger l'incident."}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={refetch} className="gap-1.5">
            <RotateCw className="h-4 w-4" />
            Réessayer
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-4xl min-h-screen flex-col overflow-y-auto p-4 md:p-6 lg:p-8"
    >
      {/* ── Back button ──────────────────────────── */}
      <button
        onClick={() => router.back()}
        className="group mb-6 inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Retour
      </button>

      {/* ── Shared Content ────────────────────────── */}
      <IncidentDetailContent
        incident={incident}
        onIncidentUpdated={refetch}
        compact={false}
      />
    </motion.div>
  );
}
