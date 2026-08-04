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
  /**
   * Canonical (lowercased) login email — populated only for ADMIN accounts,
   * null for matricule-authenticated roles.
   */
  email: string | null;
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
  /**
   * Login identifier for ADMIN accounts (mandatory for that role); send null
   * for the matricule-authenticated roles.
   */
  email: string | null;
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

/** Response of POST /api/admin/users/{id}/generate-reset-code */
export interface GenerateResetCodeResponse {
  /** Plaintext 6-character code for in-person handoff (shown once). */
  code: string;
  /** ISO timestamp at which the code expires (15-minute TTL). */
  expiresAt: string;
}

/** A single system audit entry targeting a user (GET /api/users/{id}/audit-logs). */
export interface AuditLogEntry {
  id: number;
  /** Machine-readable action, e.g. GENERATE_RESET_CODE. */
  action: string;
  /** Resolved "FirstName LastName" of the acting admin, or null if deleted. */
  actorName: string | null;
  details: string | null;
  /** ISO timestamp of the action. */
  createdAt: string;
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
  /** Incidents declared by the user that reached a terminal state (RESOLVED / NON_RESOLVED). */
  terminalCount: number;
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
