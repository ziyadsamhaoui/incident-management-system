/** Mirrors the backend `UserRole` enum */
export type UserRole = 'ADMIN' | 'CHEF_ATELIER' | 'SOUS_CHEF';

/** Mirrors the backend `LoginRequest` record */
export interface LoginRequest {
  matricule?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

/** Mirrors the backend `ClaimAccountRequest` record */
export interface ClaimAccountRequest {
  matricule: string;
  firstName: string;
  lastName: string;
  newPassword: string;
}

/** Mirrors the backend `CheckMatriculeResponse` */
export interface CheckMatriculeResponse {
  exists: boolean;
  eligibleToClaim: boolean;
}

/** Mirrors the backend `JwtAuthenticationResponse` record */
export interface JwtAuthenticationResponse {
  accessToken: string;
  refreshToken: string;
  type: string;
  matricule: number;
  roles: string[];
}

/** Represents the authenticated user's session state */
export interface AuthState {
  /** Raw JWT access token */
  accessToken: string | null;
  /** Opaque refresh token UUID */
  refreshToken: string | null;
  /** Numeric employee identifier */
  matricule: number | null;
  /** Granted authority roles */
  roles: string[];
  /** Human-readable first name (populated post-login) */
  firstName: string | null;
  /** Human-readable last name */
  lastName: string | null;
  /** Department assigned to the user (null = unassigned) */
  departmentId: string | null;
  /** Human-readable department name */
  departmentName: string | null;
  /** Whether the user has an active session */
  isAuthenticated: boolean;
  /** The detected authentication lane */
  lane: UserRole | null;
  /** Account lockout end timestamp (ISO string) */
  lockoutEnd: string | null;
}

/** Reflects the backend `UserSummaryResponse` DTO */
export interface UserSummary {
  id: number;
  firstName: string;
  lastName: string;
  matricule: number;
}

/** Shape returned when the backend returns an error */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  errors?: Record<string, string>;
}

/** ACCOUNT_UNCLAIMED error payload from backend */
export interface AccountUnclaimedError {
  code: 'ACCOUNT_UNCLAIMED';
  message: string;
}

/** Detection lane for the login page (floor terminal: 2 lanes only) */
export type AuthLane = 'SOUS_CHEF' | 'CHEF_ATELIER';

/** Zod schema shape for login form validation */
export interface LoginFormValues {
  lane: AuthLane;
  matricule?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

/** Zod schema shape for claim account form */
export interface ClaimFormValues {
  matricule: string;
  firstName: string;
  lastName: string;
  newPassword: string;
  confirmPassword: string;
}

/** Zod schema shape for admin login form */
export interface AdminLoginFormValues {
  email: string;
  password: string;
}

/** Response of POST /api/auth/password-reset/request-manual (Track A) */
export interface ManualResetResponse {
  message: string;
  /** 6-character alphanumeric code shown once on screen. */
  token: string;
  expiresInMinutes: number;
}

/** Response of POST /api/auth/password-reset/request-email (Track B) */
export interface EmailResetResponse {
  message: string;
  expiresInMinutes: number;
  /**
   * Deliberately no token: the reset token travels by email only and is never
   * returned in the response body (anti-enumeration + no stub mode).
   */
}

/** Response of POST /api/auth/password-reset/confirm (Track C) */
export interface ConfirmResetResponse {
  message: string;
  /**
   * Role of the account whose password was just reset (login-lane redirect).
   * Optional defensively — a stale backend may omit it; the UI then falls back
   * to inferring the lane from the token shape.
   */
  role?: 'CHEF_ATELIER' | 'ADMIN';
  /**
   * Matricule (CHEF_ATELIER) or email (ADMIN) to pre-fill on the login lane.
   * Optional defensively — the UI falls back to the Track A matricule param or
   * omits the pre-fill entirely rather than emitting "undefined".
   */
  loginIdentifier?: string;
}
