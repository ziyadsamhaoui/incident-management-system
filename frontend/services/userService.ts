import apiClient from '@/lib/api-client';
import type {
  UserResponseDTO,
  CreateUserRequestDTO,
  SetDepartmentPayload,
  UpdateUserRequestDTO,
  UserActivityDTO,
  ActiveAdminCountDTO,
} from '@/types/user';
import type { Page } from '@/types/incident';

/** Current authenticated user profile. */
export async function getMe(): Promise<UserResponseDTO> {
  const { data } = await apiClient.get<UserResponseDTO>('/api/me');
  return data;
}

/** Paginated user list (ADMIN only). */
export async function getUsers(params: { page?: number; size?: number } = {}): Promise<Page<UserResponseDTO>> {
  const { data } = await apiClient.get<Page<UserResponseDTO>>('/api/users', {
    params: { page: params.page ?? 0, size: params.size ?? 50 },
  });
  return data;
}

/** Fetch a single user by id (ADMIN only). */
export async function getUser(id: string | number): Promise<UserResponseDTO> {
  const { data } = await apiClient.get<UserResponseDTO>(`/api/users/${id}`);
  return data;
}

/** Correct a user's identity (names only) — audit reason handled client-side. */
export async function updateUser(
  id: string | number,
  payload: UpdateUserRequestDTO,
): Promise<UserResponseDTO> {
  const { data } = await apiClient.put<UserResponseDTO>(`/api/users/${id}`, payload);
  return data;
}

/** Create a new user (ADMIN only). */
export async function createUser(payload: CreateUserRequestDTO): Promise<UserResponseDTO> {
  const { data } = await apiClient.post<UserResponseDTO>('/api/users', payload);
  return data;
}

/** Promote a SOUS_CHEF to CHEF_ATELIER (ADMIN only). */
export async function promoteUser(id: number): Promise<UserResponseDTO> {
  const { data } = await apiClient.put<UserResponseDTO>(`/api/users/${id}/promote`);
  return data;
}

/** Demote a CHEF_ATELIER back to SOUS_CHEF (resets password + department). */
export async function demoteUser(id: number): Promise<UserResponseDTO> {
  const { data } = await apiClient.put<UserResponseDTO>(`/api/users/${id}/demote`);
  return data;
}

/** Cancel a pending promotion for an unclaimed CHEF_ATELIER. */
export async function cancelPromotion(id: number): Promise<UserResponseDTO> {
  const { data } = await apiClient.put<UserResponseDTO>(`/api/users/${id}/cancel-promotion`);
  return data;
}

/** Reactivate a deactivated user (ADMIN only). */
export async function activateUser(id: number): Promise<UserResponseDTO> {
  const { data } = await apiClient.put<UserResponseDTO>(`/api/users/${id}/activate`);
  return data;
}

/** Deactivate a user (ADMIN only). */
export async function deactivateUser(id: number): Promise<UserResponseDTO> {
  const { data } = await apiClient.put<UserResponseDTO>(`/api/users/${id}/deactivate`);
  return data;
}

/** Number of active ADMIN accounts — last-admin guard (ADMIN only). */
export async function getActiveAdminCount(): Promise<ActiveAdminCountDTO> {
  const { data } = await apiClient.get<ActiveAdminCountDTO>('/api/users/active-admin-count');
  return data;
}

/**
 * On-demand activity analytics for a user (ADMIN only) — declared / claimed /
 * resolved counts plus per-day buckets. Computed server-side via SQL.
 */
export async function getUserActivity(id: number): Promise<UserActivityDTO> {
  const { data } = await apiClient.get<UserActivityDTO>(`/api/users/${id}/activity`);
  return data;
}

/** One-shot onboarding — assign the current user's department. */
export async function setMyDepartment(
  payload: SetDepartmentPayload,
): Promise<UserResponseDTO> {
  const { data } = await apiClient.patch<UserResponseDTO>(
    '/api/users/me/department',
    { departmentId: payload.departmentId },
  );
  return data;
}
