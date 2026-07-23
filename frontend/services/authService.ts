import apiClient from '@/lib/api-client';
import type {
  LoginRequest,
  JwtAuthenticationResponse,
  ApiError,
} from '@/types/auth';
import type { AxiosError } from 'axios';

/**
 * Attempt to log in via the unified multi-channel endpoint.
 * Throws an enriched error with `retryAfterSeconds` on 429
 * and `lockoutEnd` on 423.
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
    const axiosErr = err as AxiosError<ApiError>;

    // 423 Locked — account temporarily locked
    if (axiosErr.response?.status === 423) {
      const lockoutEnd =
        (axiosErr.response.data as any)?.lockoutEnd ?? null;
      throw { code: 'LOCKED', lockoutEnd, message: 'Account is locked.' };
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
 */
export async function requestPasswordResetManual(matricule: number) {
  const { data } = await apiClient.post<{
    message: string;
    token: string;
    expiresInMinutes: number;
  }>('/api/auth/password-reset/request-manual', { matricule });
  return data;
}

/**
 * Request an email-based password-reset token (Track B — ADMIN).
 */
export async function requestPasswordResetEmail(email: string) {
  const { data } = await apiClient.post<{
    message: string;
    token: string;
    expiresInMinutes: number;
  }>('/api/auth/password-reset/request-email', { email });
  return data;
}

/**
 * Confirm a password reset (Track C — unified endpoint).
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
) {
  const { data } = await apiClient.post<{ message: string }>(
    '/api/auth/password-reset/confirm',
    { token, newPassword },
  );
  return data;
}
