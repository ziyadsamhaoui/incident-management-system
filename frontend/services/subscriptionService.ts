import apiClient from '@/lib/api-client';
import type { DepartmentRef } from '@/services/referenceService';

/** List the departments an admin user is currently subscribed to. */
export async function getSubscribedDepartments(
  userId: number,
): Promise<DepartmentRef[]> {
  const { data } = await apiClient.get<DepartmentRef[]>(
    `/api/users/${userId}/subscriptions`,
  );
  return data;
}

/** Subscribe the admin user to a department. */
export async function subscribeToDepartment(
  userId: number,
  departmentId: number,
): Promise<void> {
  await apiClient.post(`/api/users/${userId}/subscriptions/${departmentId}`);
}

/** Unsubscribe the admin user from a department. */
export async function unsubscribeFromDepartment(
  userId: number,
  departmentId: number,
): Promise<void> {
  await apiClient.delete(`/api/users/${userId}/subscriptions/${departmentId}`);
}
