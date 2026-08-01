import apiClient from '@/lib/api-client';
import type { NotificationDTO } from '@/types/notification';
import type { Page } from '@/types/incident';

/**
 * Fetch the current user's notifications.
 * The backend returns *unread* notifications for the given user.
 */
export async function getNotifications(
  userId: number,
  params: { page?: number; size?: number } = {},
): Promise<Page<NotificationDTO>> {
  const { data } = await apiClient.get<Page<NotificationDTO>>('/api/notifications', {
    params: { userId, page: params.page ?? 0, size: params.size ?? 50 },
  });
  return data;
}

/**
 * Fetch the current user's full notification history (read + unread).
 */
export async function getAllNotifications(
  userId: number,
  params: { page?: number; size?: number } = {},
): Promise<Page<NotificationDTO>> {
  const { data } = await apiClient.get<Page<NotificationDTO>>('/api/notifications/all', {
    params: { userId, page: params.page ?? 0, size: params.size ?? 50 },
  });
  return data;
}

/** Mark a single notification as read. */
export async function markNotificationAsRead(id: number): Promise<void> {
  await apiClient.put(`/api/notifications/${id}/read`);
}
