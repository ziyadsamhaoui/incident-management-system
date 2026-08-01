import apiClient from '@/lib/api-client';
import type { UserResponseDTO, CreateUserRequestDTO, SetDepartmentPayload } from '@/types/user';
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

/** Deactivate a user (ADMIN only). */
export async function deactivateUser(id: number): Promise<UserResponseDTO> {
  const { data } = await apiClient.put<UserResponseDTO>(`/api/users/${id}/deactivate`);
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
