import apiClient from '@/lib/api-client';
import type {
  LoginRequest,
  JwtAuthenticationResponse,
  ApiError,
  ClaimAccountRequest,
  CheckMatriculeResponse,
  AccountUnclaimedError,
  ManualResetResponse,
  EmailResetResponse,
  ConfirmResetResponse,
} from '@/types/auth';
import type { AxiosError } from 'axios';

/**
 * Attempt to log in via the unified multi-channel endpoint.
 * Throws an enriched error with `retryAfterSeconds` on 429
 * and `lockoutEnd` on 423, and `code: 'ACCOUNT_UNCLAIMED'` on 403 with unclaimed code.
 */
export async function login(
  credentials: LoginRequest,
): Promise<JwtAuthenticationResponse> {
  try {
    const { data } = await apiClient.post<JwtAuthenticationResponse>(
      '/api/auth/login',
      credentials,
    );
    return data;
  } catch (err) {
    const axiosErr = err as AxiosError<ApiError | AccountUnclaimedError>;

    // 403 Forbidden — check if it's an ACCOUNT_UNCLAIMED error
    if (axiosErr.response?.status === 403) {
      const errorData = axiosErr.response.data as any;
      if (errorData?.code === 'ACCOUNT_UNCLAIMED') {
        throw {
          code: 'ACCOUNT_UNCLAIMED',
          message: errorData.message || 'Compte non réclamé. Veuillez d\'abord réclamer votre compte.',
        };
      }
    }

    // 423 Locked — account temporarily locked
    if (axiosErr.response?.status === 423) {
      const data = axiosErr.response.data as any;
      throw {
        code: 'LOCKED',
        lockoutEnd: data?.lockoutEnd ?? null,
        message: data?.error ?? 'Account is locked.',
      };
    }

    // 429 Rate limited
    if (axiosErr.response?.status === 429) {
      const retryAfter = Number.parseInt(
        axiosErr.response.headers?.['retry-after'] as string,
        10,
      );
      throw {
        code: 'RATE_LIMITED',
        retryAfterSeconds: Number.isNaN(retryAfter) ? 60 : retryAfter,
        message: 'Too many requests. Please wait.',
      };
    }

    // 401 / other
    throw {
      code: 'AUTH_FAILED',
      message:
        axiosErr.response?.data?.message ?? 'Invalid credentials.',
    };
  }
}

/**
 * Attempt to log in via the admin-only endpoint (email + password).
 */
export async function adminLogin(
  email: string,
  password: string,
): Promise<JwtAuthenticationResponse> {
  try {
    const { data } = await apiClient.post<JwtAuthenticationResponse>(
      '/api/auth/login',
      { email, password },
    );
    return data;
  } catch (err) {
    const axiosErr = err as AxiosError<ApiError>;

    if (axiosErr.response?.status === 423) {
      const data = axiosErr.response.data as any;
      throw {
        code: 'LOCKED',
        lockoutEnd: data?.lockoutEnd ?? null,
        message: data?.error ?? 'Account is locked.',
      };
    }

    if (axiosErr.response?.status === 429) {
      const retryAfter = Number.parseInt(
        axiosErr.response.headers?.['retry-after'] as string,
        10,
      );
      throw {
        code: 'RATE_LIMITED',
        retryAfterSeconds: Number.isNaN(retryAfter) ? 60 : retryAfter,
        message: 'Too many requests. Please wait.',
      };
    }

    throw {
      code: 'AUTH_FAILED',
      message:
        axiosErr.response?.data?.message ?? 'Invalid credentials.',
    };
  }
}

/**
 * Claim a promoted CHEF_ATELIER account by setting its password.
 */
export async function claimAccount(
  payload: ClaimAccountRequest,
): Promise<JwtAuthenticationResponse> {
  try {
    const { data } = await apiClient.post<JwtAuthenticationResponse>(
      '/api/auth/claim',
      payload,
    );
    return data;
  } catch (err) {
    const axiosErr = err as AxiosError<ApiError>;
    const data = axiosErr.response?.data as any;
    throw {
      // Extract the backend code (e.g. ALREADY_CLAIMED, IDENTITY_MISMATCH) so
      // the claim page can map it to a translated message.
      code: data?.code ?? 'CLAIM_FAILED',
      message: data?.message ?? 'Failed to claim account.',
    };
  }
}

/**
 * Check matricule existence and eligibility to claim.
 * Returns boolean-only response (zero PII exposure).
 */
export async function checkMatricule(
  matricule: string,
): Promise<CheckMatriculeResponse> {
  const { data } = await apiClient.get<CheckMatriculeResponse>(
    '/api/auth/check-matricule',
    { params: { matricule } },
  );
  return data;
}

/**
 * Exchange a refresh token for a new access token.
 */
export async function refreshAccessToken(refreshToken: string) {
  const { data } = await apiClient.post<{ accessToken: string; type: string }>(
    '/api/auth/refresh',
    { refreshToken },
  );
  return data;
}

/**
 * Log out by blacklisting the current Bearer token.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout');
}

/**
 * Request a manual password-reset token (Track A — CHEF_ATELIER / floor staff).
 * Requires the full identity bar (matricule + firstName + lastName) matching
 * the login identity threshold — the backend rejects any mismatch generically
 * with "Identifiants invalides" (no identity enumeration).
 */
export async function requestPasswordResetManual(
  matricule: number,
  firstName: string,
  lastName: string,
): Promise<ManualResetResponse> {
  const { data } = await apiClient.post<ManualResetResponse>(
    '/api/auth/password-reset/request-manual',
    { matricule, firstName, lastName },
  );
  return data;
}

/**
 * Request an email-based password-reset link (Track B — ADMIN).
 *
 * Neutral-response contract: the backend ALWAYS answers with the same
 * non-committal notice whether or not the address exists — this service simply
 * surfaces that body. The actual reset token is delivered by real email
 * (Gmail SMTP via Spring Mail) and is never present in the response.
 */
export async function requestPasswordResetEmail(email: string): Promise<EmailResetResponse> {
  const { data } = await apiClient.post<EmailResetResponse>(
    '/api/auth/password-reset/request-email',
    { email },
  );
  return data;
}

/**
 * Confirm a password reset (Track C — unified endpoint).
 * Returns the account's role + login identifier so the UI can route to the
 * correct login lane (matricule pre-filled for CHEF_ATELIER, email for ADMIN).
 * NO auto-login: the user must log in explicitly with the new password.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<ConfirmResetResponse> {
  const { data } = await apiClient.post<ConfirmResetResponse>(
    '/api/auth/password-reset/confirm',
    { token, newPassword },
  );
  return data;
}
