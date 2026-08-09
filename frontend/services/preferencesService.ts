import apiClient from '@/lib/api-client';

/** UI language codes — kept local to avoid a circular import with lib/i18n. */
type Lang = 'FR' | 'AR';

/**
 * Per-user UI preferences, persisted server-side in Redis
 * ({@code pref:lang:{matricule}}) so the choice follows the user across
 * devices, reloads and horizontally scaled instances.
 *
 * Both calls are best-effort from the UI's perspective — the local
 * localStorage copy keeps the interface functional when the backend is
 * unreachable or the user is not authenticated yet.
 */

/** Fetch the stored UI language, or null when never set / not reachable. */
export async function getLanguagePreference(): Promise<Lang | null> {
  try {
    const { data } = await apiClient.get<{ language?: string }>(
      '/api/me/preferences/language',
    );
    return data?.language === 'AR' || data?.language === 'FR' ? data.language : null;
  } catch {
    return null;
  }
}

/** Persist the UI language in Redis (fire-and-forget from callers). */
export async function setLanguagePreference(lang: Lang): Promise<void> {
  try {
    await apiClient.put('/api/me/preferences/language', { language: lang });
  } catch {
    // Best-effort — the local preference still applies for this session.
  }
}
