'use client';

import { DeclareIncidentForm } from '@/components/incidents/declare-incident-form';

export default function DeclareIncidentPage() {
  return <DeclareIncidentForm homePath="/sous-chef" draftKey="incident_draft_sous_chef" />;
}
