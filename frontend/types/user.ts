/** Mirrors backend `DepartmentResponse` */
export interface DepartmentRef {
  id: number;
  name: string;
}

/** Mirrors backend `UserResponse` record */
export interface UserResponseDTO {
  id: number;
  firstName: string;
  lastName: string;
  matricule: number;
  isActive: boolean;
  role: 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';
  department: DepartmentRef | null;
  createdAt: string;
  /**
   * True when a password is set (account claimed). False for promoted
   * CHEF_ATELIER awaiting the claim flow — rendered as "En attente".
   */
  claimed: boolean;
}

/** Payload for POST /api/users */
export interface CreateUserRequestDTO {
  firstName: string;
  lastName: string;
  password: string;
  matricule: number;
  role: 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';
  departmentId: number | null;
}

/** Legacy alias used by settings/profile screens */
export interface UserProfileDTO {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  role: 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';
  departmentId: string | null;
  departmentName?: string | null;
  isFirstLogin: boolean;
}

/** Payload for assigning / changing the current user's department */
export interface SetDepartmentPayload {
  departmentId: number;
}

/** A single YYYY-MM-DD bucket of an aggregated count. */
export interface DayCount {
  date: string;
  count: number;
}

/** Mirrors backend `UserActivityResponse` (GET /api/users/{id}/activity) */
export interface UserActivityDTO {
  declaredCount: number;
  openCount: number;
  resolvedCount: number;
  closedCount: number;
  claimedCount: number;
  avgTimeToClaimMinutes: number;
  avgMttrMinutes: number;
  declaredByDay: DayCount[];
  resolvedByDay: DayCount[];
}

/** Mirrors backend `ActiveAdminCountResponse` (GET /api/users/active-admin-count) */
export interface ActiveAdminCountDTO {
  activeAdminCount: number;
}

/** Payload for correcting a user's identity (names) via PUT /api/users/{id} */
export interface UpdateUserRequestDTO {
  firstName?: string;
  lastName?: string;
}
