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
  status?: string;
  departmentId?: number;
  userId?: number;
  page?: number;
  size?: number;
  /** Spring Data sort, e.g. 'declaredAt,desc'. */
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
  const { data } = await apiClient.get<Page<RawIncident>>('/api/incidents', {
    params: {
      page: params.page ?? 0,
      size: params.size ?? 20,
      ...(params.status ? { status: params.status } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
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

/** Declare a new incident (SOUS_CHEF / CHEF_ATELIER only). */
export async function createIncident(
  payload: CreateIncidentRequest,
): Promise<IncidentDTO> {
  const { data } = await apiClient.post<RawIncident>('/api/incidents', payload);
  return mapIncident(data);
}

/** Claim an incident (DECLARED → CLAIMED, ADMIN only). */
export async function claimIncident(
  id: string | number,
): Promise<IncidentDTO> {
  const { data } = await apiClient.put<RawIncident>(`/api/incidents/${id}/claim`);
  return mapIncident(data);
}

/** Progress an incident (CLAIMED → IN_PROGRESS). */
export async function progressIncident(
  id: string | number,
): Promise<IncidentDTO> {
  const { data } = await apiClient.put<RawIncident>(`/api/incidents/${id}/progress`);
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
  );
  return mapIncident(data);
}
