import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, AuthLane, LoginRequest, JwtAuthenticationResponse } from '@/types/auth';
import { configureApiClient } from '@/lib/api-client';

// ──────────────────────────────────────────────────
//  Store interface
// ──────────────────────────────────────────────────

interface AuthActions {
  /** Persist login response into the store */
  loginSucceeded: (res: JwtAuthenticationResponse, lane: AuthLane) => void;
  /** Store user identity fields populated after login */
  setUserIdentity: (firstName: string, lastName: string) => void;
  /** Replace the access token (used by 401 refresh interceptor) */
  setAccessToken: (token: string) => void;
  /** Set lockout timestamp */
  setLockoutEnd: (iso: string | null) => void;
  /** Clear session (logout / token expired) */
  logout: () => void;
  /** Hydrate persisted state on app initialisation */
  hydrate: () => void;
}

type AuthStore = AuthState & AuthActions;

// ──────────────────────────────────────────────────
//  Initial state
// ──────────────────────────────────────────────────

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  matricule: null,
  roles: [],
  firstName: null,
  lastName: null,
  isAuthenticated: false,
  lane: null,
  lockoutEnd: null,
};

// ──────────────────────────────────────────────────
//  Store
// ──────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      loginSucceeded: (res: JwtAuthenticationResponse, lane: AuthLane) => {
        set({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          matricule: res.matricule,
          roles: res.roles,
          isAuthenticated: true,
          lane,
          lockoutEnd: null,
        });
      },

      setUserIdentity: (firstName: string, lastName: string) => {
        set({ firstName, lastName });
      },

      setAccessToken: (token: string) => {
        set({ accessToken: token });
      },

      setLockoutEnd: (iso: string | null) => {
        set({ lockoutEnd: iso });
      },

      logout: () => {
        set({ ...initialState });
      },

      hydrate: () => {
        // Nothing extra needed — Zustand persist handles hydration.
        // This hook is provided for future initialisation logic.
      },
    }),
    {
      name: 'icglma-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        matricule: state.matricule,
        roles: state.roles,
        firstName: state.firstName,
        lastName: state.lastName,
        isAuthenticated: state.isAuthenticated,
        lane: state.lane,
      }),
    },
  ),
);

// ──────────────────────────────────────────────────
//  Bootstrap: wire up the API client to this store
// ──────────────────────────────────────────────────

configureApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onSessionExpired: () => {
    useAuthStore.getState().logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },
  onRateLimited: (retryAfterSeconds: number) => {
    // The login page listens to this via the store or a toast system.
    // For now, we store the value so the UI can display a countdown.
    console.warn(`Rate limited. Retry after ${retryAfterSeconds}s`);
  },
});
