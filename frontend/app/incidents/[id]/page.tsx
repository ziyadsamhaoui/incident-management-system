'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IncidentDetailContent } from '@/components/incidents/incident-detail-content';
import { getIncidentById } from '@/services/incidentService';
import type { IncidentDetailDTO } from '@/types/incident';

// ── Mock data ─────────────────────────────────────
// Used when the backend is not connected

const MOCK_INCIDENT: IncidentDetailDTO = {
  id: '1',
  reference: 'INC-20260714-0001',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  department: 'Assembly Line A',
  station: 'ASM-L1-S3',
  category: 'Mechanical Failure',
  description:
    'Conveyor belt motor #3 is overheating after prolonged operation. Temperature readings exceeded 85°C during the third shift. The line was temporarily halted to prevent damage to the belt system. Immediate inspection and potential motor replacement required to resume full production capacity.',
  createdAt: '2026-07-14T08:23:15',
  declaredAt: '2026-07-14T08:23:15',
  claimedAt: '2026-07-14T08:45:00',
  inProgressAt: '2026-07-14T08:46:00',
  resolvedAt: null,
  closedAt: null,
  assignedTo: {
    id: '42',
    firstName: 'Ahmed',
    lastName: 'Bennani',
    matricule: '1001',
  },
  resolvedBy: null,
  resolutionNote: null,
  history: [
    {
      id: '1',
      action: 'Incident Declared',
      performedBy: {
        id: '5',
        firstName: 'Mohamed',
        lastName: 'Amraoui',
        matricule: '1005',
      },
      timestamp: '2026-07-14T08:23:15',
    },
    {
      id: '2',
      action: 'Claimed by',
      performedBy: {
        id: '42',
        firstName: 'Ahmed',
        lastName: 'Bennani',
        matricule: '1001',
      },
      timestamp: '2026-07-14T08:45:00',
    },
    {
      id: '3',
      action: 'In Progress',
      performedBy: {
        id: '42',
        firstName: 'Ahmed',
        lastName: 'Bennani',
        matricule: '1001',
      },
      timestamp: '2026-07-14T08:46:00',
      note: 'Auto-progression from CLAIMED to IN_PROGRESS',
    },
  ],
};

// ── Page ──────────────────────────────────────────

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id as string;

  const [incident, setIncident] = useState<IncidentDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        try {
          const data = await getIncidentById(incidentId);
          setIncident(data);
        } catch {
          setIncident(MOCK_INCIDENT);
        }
      } catch {
        setError('Failed to load incident details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [incidentId]);

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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h2 className="text-xl font-bold">Erreur</h2>
        <p className="text-sm text-muted-foreground">
          {error ?? "Impossible de charger l'incident."}
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
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
        onIncidentUpdated={setIncident}
        compact={false}
      />
    </motion.div>
  );
}
