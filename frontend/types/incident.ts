// ── Incident Types ─────────────────────────────────
// Mirrors backend DTOs with explicit legacy field mapping

/** User summary embedded in incident responses */
export interface IncidentUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
}

/** Incident status enum */
export type IncidentStatus =
  | 'DECLARED'
  | 'CLAIMED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'NON_RESOLVED'
  | 'CLOSED';

/** Incident priority enum */
export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Single audit history entry */
export interface IncidentHistoryEntry {
  id: string;
  action: string;
  performedBy: IncidentUserSummary;
  timestamp: string;
  note?: string | null;
}

/**
 * Incident detail DTO.
 *
 * ⚠️ LEGACY FIELD TRAP: The backend `IncidentResponse` DTO exposes the
 * claiming admin under the field name `assignedTo` (from pre-refactor
 * naming). This maps to the Entity's `claimedBy`. Our frontend type
 * explicitly names it `assignedTo` to match the JSON payload, and we
 * alias it to `claimedBy` at consumption time.
 */
export interface IncidentDetailDTO {
  id: string;
  reference: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  department: string;
  station: string;
  category: string;
  description: string;
  createdAt: string;

  // Timestamps
  declaredAt: string;
  claimedAt?: string | null;
  inProgressAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;

  // LEGACY FIELD: API returns 'assignedTo' for the claimedBy user object
  assignedTo?: IncidentUserSummary | null;
  resolvedBy?: IncidentUserSummary | null;
  resolutionNote?: string | null;

  // Audit trail
  history: IncidentHistoryEntry[];
}

/** Request payload for incident evaluation */
export interface EvaluateIncidentRequest {
  status: 'RESOLVED' | 'NON_RESOLVED';
  note: string;
}

/** Convenience alias for the legacy assignedTo → claimedBy mapping */
export type ClaimedByInfo = IncidentUserSummary | null | undefined;
