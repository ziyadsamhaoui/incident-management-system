/** Mirrors backend `NotificationResponse` */
export interface NotificationDTO {
  id: number;
  incidentId: number | null;
  incidentReference: string | null;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string;
}
