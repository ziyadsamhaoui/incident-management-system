'use client';

import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiError } from '@/types/auth';

// ──────────────────────────────────────────────────
//  Client-side API client
// ──────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ──────────────────────────────────────────────────
//  Token management helpers
// ──────────────────────────────────────────────────

let getAccessToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let onSessionExpired: (() => void) | null = null;
let onRateLimited: ((retryAfterSeconds: number) => void) | null = null;

/**
 * Registers callbacks that the API client uses to interact with
 * the auth store and UI layer. Must be called during app initialisation.
 */
export function configureApiClient(config: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onSessionExpired: () => void;
  onRateLimited: (retryAfterSeconds: number) => void;
}) {
  getAccessToken = config.getAccessToken;
  getRefreshToken = config.getRefreshToken;
  onSessionExpired = config.onSessionExpired;
  onRateLimited = config.onRateLimited;
}

// ──────────────────────────────────────────────────
//  Request interceptor — inject Bearer token
// ──────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ──────────────────────────────────────────────────
//  Response interceptor — 401 refresh / 429 backoff
// ──────────────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) return Promise.reject(error);

    // ── 429 Too Many Requests ──
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const seconds = retryAfter ? Number.parseInt(retryAfter as string, 10) : 60;
      onRateLimited?.(seconds);
      return Promise.reject(error);
    }

    // ── 401 Unauthorised — attempt token refresh ──
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        onSessionExpired?.();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken: string = data.accessToken;

        // Update the store's token
        // (import dynamically to avoid circular dependency)
        const { useAuthStore } = await import('@/store/useAuthStore');
        useAuthStore.getState().setAccessToken(newAccessToken);

        onTokenRefreshed(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch {
        onSessionExpired?.();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
