import apiClient from '@/lib/api-client';
import type { IncidentDetailDTO, EvaluateIncidentRequest } from '@/types/incident';

/**
 * Fetch a single incident by its ID.
 */
export async function getIncidentById(id: string): Promise<IncidentDetailDTO> {
  const { data } = await apiClient.get<IncidentDetailDTO>(`/api/incidents/${id}`);
  return data;
}

/**
 * Claim an incident (DECLARED → CLAIMED).
 * ADMIN-only on the backend (@PreAuthorize("hasRole('ADMIN')")).
 */
export async function claimIncident(id: string): Promise<IncidentDetailDTO> {
  const { data } = await apiClient.put<IncidentDetailDTO>(`/api/incidents/${id}/claim`);
  return data;
}

/**
 * Progress an incident to IN_PROGRESS (CLAIMED → IN_PROGRESS).
 * Any authenticated user can call this endpoint.
 */
export async function progressIncident(id: string): Promise<IncidentDetailDTO> {
  const { data } = await apiClient.put<IncidentDetailDTO>(`/api/incidents/${id}/progress`);
  return data;
}

/**
 * Evaluate a resolved/non-resolved outcome (IN_PROGRESS → RESOLVED | NON_RESOLVED).
 * ADMIN-only on the backend (@PreAuthorize("hasRole('ADMIN')")).
 */
export async function evaluateIncident(
  id: string,
  payload: EvaluateIncidentRequest,
): Promise<IncidentDetailDTO> {
  const { data } = await apiClient.put<IncidentDetailDTO>(
    `/api/incidents/${id}/evaluate`,
    payload,
  );
  return data;
}
