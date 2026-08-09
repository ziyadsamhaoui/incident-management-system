import apiClient from '@/lib/api-client';
import type {
  IncidentDTO,
  IncidentDetailDTO,
  IncidentHistoryEntry,
  CreateIncidentRequest,
  EvaluateIncidentRequest,
  Page,
} from '@/types/incident';

export interface IncidentListParams {
  /** Legacy single-status filter (e.g. 'DECLARED'). */
  status?: string;
  /** Multi-status group sent as comma-separated `status` (e.g. ['RESOLVED','NON_RESOLVED']). */
  statuses?: string[];
  /** Case-insensitive term matched against reference, description and resolutionNote. */
  search?: string;
  departmentId?: number;
  userId?: number;
  /** Inclusive lower bound (yyyy-MM-dd) on the `dateField` column. */
  startDate?: string;
  /** Inclusive upper bound (yyyy-MM-dd) on the `dateField` column. */
  endDate?: string;
  /** Timestamp column used by the date range: 'declaredAt' (default) or 'resolvedAt' (Logs). */
  dateField?: string;
  page?: number;
  size?: number;
  /** Spring Data sort, e.g. 'resolvedAt,desc'. */
  sort?: string;
}

// ── Mapping: raw backend IncidentResponse → frontend IncidentDTO ──

interface RawIncident {
  id: number;
  reference: string;
  user: { id: number; firstName: string; lastName: string; matricule: number } | null;
  assignedTo: { id: number; firstName: string; lastName: string; matricule: number } | null;
  resolvedBy: { id: number; firstName: string; lastName: string; matricule: number } | null;
  department: { id: number; name: string } | null;
  station: { id: number; code: string } | null;
  category: { id: number; name: string } | null;
  priority: string;
  status: string;
  description: string;
  resolutionNote: string | null;
  declaredAt: string;
  claimedAt: string | null;
  inProgressAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

function mapIncident(raw: RawIncident): IncidentDTO {
  return {
    id: raw.id,
    reference: raw.reference,
    user: raw.user,
    assignedTo: raw.assignedTo,
    resolvedBy: raw.resolvedBy,
    department: raw.department?.name ?? '—',
    station: raw.station?.code ?? '—',
    category: raw.category?.name ?? '—',
    priority: raw.priority as IncidentDTO['priority'],
    status: raw.status as IncidentDTO['status'],
    description: raw.description ?? '',
    resolutionNote: raw.resolutionNote,
    declaredAt: raw.declaredAt,
    claimedAt: raw.claimedAt,
    inProgressAt: raw.inProgressAt,
    resolvedAt: raw.resolvedAt,
    closedAt: raw.closedAt,
  };
}

// ── Reads ───────────────────────────────────────────

/** Fetch a paginated incident list, optionally filtered by status/department/user. */
export async function getIncidents(
  params: IncidentListParams = {},
): Promise<Page<IncidentDTO>> {
  const statusParam = params.statuses?.length
    ? params.statuses.join(',')
    : params.status;

  const { data } = await apiClient.get<Page<RawIncident>>('/api/incidents', {
    params: {
      page: params.page ?? 0,
      size: params.size ?? 20,
      ...(statusParam ? { status: statusParam } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.startDate ? { startDate: params.startDate } : {}),
      ...(params.endDate ? { endDate: params.endDate } : {}),
      ...(params.dateField ? { dateField: params.dateField } : {}),
      ...(params.sort ? { sort: params.sort } : {}),
    },
  });
  return { ...data, content: data.content.map(mapIncident) };
}

/** Fetch a single incident by ID. */
export async function getIncidentById(id: string | number): Promise<IncidentDTO> {
  const { data } = await apiClient.get<RawIncident>(`/api/incidents/${id}`);
  return mapIncident(data);
}

/** Fetch the chronological audit trail for an incident. */
export async function getIncidentHistory(
  id: string | number,
): Promise<IncidentHistoryEntry[]> {
  const { data } = await apiClient.get<IncidentHistoryEntry[]>(
    `/api/incidents/${id}/history`,
  );
  return data;
}

/** Fetch incident detail + its audit trail. */
export async function getIncidentDetail(
  id: string | number,
): Promise<IncidentDetailDTO> {
  const [incident, history] = await Promise.all([
    getIncidentById(id),
    getIncidentHistory(id),
  ]);
  return { ...incident, history };
}

/** Fetch aging incidents (CLAIMED/IN_PROGRESS for more than 2h). */
export async function getStaleIncidents(): Promise<IncidentDTO[]> {
  const { data } = await apiClient.get<RawIncident[]>('/api/incidents/stale');
  return data.map(mapIncident);
}

// ── Writes ──────────────────────────────────────────

/**
 * Generates a fresh idempotency key per submission attempt (UUID v4).
 * Operators on flaky factory Wi-Fi re-tap "Déclarer" after a client-side
 * timeout; the backend deduplicates retries carrying the same key, so a
 * double-submit can never create two incidents.
 */
function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Declare a new incident (SOUS_CHEF / CHEF_ATELIER only). */
export async function createIncident(
  payload: CreateIncidentRequest,
): Promise<IncidentDTO> {
  const { data } = await apiClient.post<RawIncident>('/api/incidents', payload, {
    headers: { 'X-Idempotency-Key': newIdempotencyKey() },
  });
  return mapIncident(data);
}

/** Claim an incident (DECLARED → CLAIMED, ADMIN only). */
export async function claimIncident(
  id: string | number,
): Promise<IncidentDTO> {
  const { data } = await apiClient.put<RawIncident>(`/api/incidents/${id}/claim`, undefined, {
    headers: { 'X-Idempotency-Key': newIdempotencyKey() },
  });
  return mapIncident(data);
}

/** Progress an incident (CLAIMED → IN_PROGRESS). */
export async function progressIncident(
  id: string | number,
): Promise<IncidentDTO> {
  const { data } = await apiClient.put<RawIncident>(`/api/incidents/${id}/progress`, undefined, {
    headers: { 'X-Idempotency-Key': newIdempotencyKey() },
  });
  return mapIncident(data);
}

/** Evaluate an incident (IN_PROGRESS → RESOLVED | NON_RESOLVED, ADMIN only). */
export async function evaluateIncident(
  id: string | number,
  payload: EvaluateIncidentRequest,
): Promise<IncidentDTO> {
  const { data } = await apiClient.put<RawIncident>(
    `/api/incidents/${id}/evaluate`,
    payload,
    { headers: { 'X-Idempotency-Key': newIdempotencyKey() } },
  );
  return mapIncident(data);
}
