'use client';

import { DeclareIncidentForm } from '@/components/incidents/declare-incident-form';

export default function AdminDeclareIncidentPage() {
  return <DeclareIncidentForm homePath="/admin/incidents" draftKey="incident_draft_admin" />;
}
