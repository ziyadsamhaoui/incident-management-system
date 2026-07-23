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

/** Detection lane for the login page */
export type AuthLane = 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';

/** Zod schema shape for login form validation */
export interface LoginFormValues {
  lane: AuthLane;
  matricule?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}
