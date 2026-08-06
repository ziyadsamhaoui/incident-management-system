// ── Incident Types ─────────────────────────────────
// Mirrors the real backend `IncidentResponse` DTO (no fabricated fields).

export type IncidentStatus =
  | 'DECLARED'
  | 'CLAIMED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'NON_RESOLVED';

export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IncidentUserSummary {
  id: number;
  firstName: string;
  lastName: string;
  matricule: number;
}

export interface DepartmentRef {
  id: number;
  name: string;
}

export interface CategoryRef {
  id: number;
  name: string;
}

export interface StationRef {
  id: number;
  code: string;
  rowIndex: number;
  lineIndex: number;
  isWorking: boolean;
  productionLineId: number | null;
}

/**
 * Flattened incident DTO consumed by the UI.
 * `department`/`station`/`category` are display strings resolved from the
 * backend's nested reference objects.
 */
export interface IncidentDTO {
  id: number;
  reference: string;
  /** Declaring user */
  user: IncidentUserSummary | null;
  /** Claiming admin (claimedBy) */
  assignedTo: IncidentUserSummary | null;
  resolvedBy: IncidentUserSummary | null;
  department: string;
  station: string;
  category: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  description: string;
  resolutionNote: string | null;
  declaredAt: string;
  claimedAt: string | null;
  inProgressAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

/** Single audit history entry (from GET /api/incidents/{id}/history) */
export interface IncidentHistoryEntry {
  id: number;
  incidentId: number;
  previousStatus: IncidentStatus;
  currentStatus: IncidentStatus;
  changedAt: string;
  comment: string | null;
  actor: IncidentUserSummary | null;
}

/** Incident + its chronological audit trail */
export interface IncidentDetailDTO extends IncidentDTO {
  history: IncidentHistoryEntry[];
}

/** Payload for POST /api/incidents */
export interface CreateIncidentRequest {
  userId: number;
  departmentId: number;
  stationId: number;
  categoryId: number;
  priority: IncidentPriority;
  /** Optional free-text note — the backend accepts null (photo-only declarations). */
  description: string | null;
}

/** Payload for PUT /api/incidents/{id}/evaluate */
export interface EvaluateIncidentRequest {
  status: 'RESOLVED' | 'NON_RESOLVED';
  note: string;
}

/** Spring Data Page<T> envelope */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
