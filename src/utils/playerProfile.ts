// Login identity is kept only in this page's memory, never browser storage.

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: number;
  kind?: 'student' | 'guest';
  pin?: string | null;
  sessionToken?: string;
}

export const STORAGE_KEY_PLAYER_ID = 'skilltype_player_id';
export const STORAGE_KEY_PLAYER_NAME = 'skilltype_player_name';
export const STORAGE_KEY_ACTIVE_PLAYER = 'skilltype_active_player';
export const STORAGE_KEY_ALL_PLAYERS = 'skilltype_local_players';

/**
 * Generate a standard RFC4122 v4 UUID string.
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Backwards-compatible alias for generating player ID as UUID.
 */
export function generatePlayerId(): string {
  return generateUuid();
}

/**
 * Strip HTML and control characters, trim and limit to 25 characters.
 */
export function sanitizePlayerName(name: string): string {
  if (typeof name !== 'string') return '';
  return name
    .replace(/<[^>]*>?/gm, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .substring(0, 25);
}

/**
 * Sanitize and validate player name:
 * - 2 to 25 characters
 * - Trim extra whitespace
 * - Disallow HTML / script injection
 */
export function validatePlayerName(name: string): {
  valid: boolean;
  error?: string;
  trimmedName: string;
} {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Name must be text.', trimmedName: '' };
  }

  // Strip HTML tags and control characters
  const cleaned = name
    .replace(/<[^>]*>?/gm, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  if (cleaned.length < 2) {
    return {
      valid: false,
      error: 'Name must be at least 2 characters long.',
      trimmedName: cleaned,
    };
  }

  if (cleaned.length > 25) {
    return {
      valid: false,
      error: 'Name must be 25 characters or fewer.',
      trimmedName: cleaned.substring(0, 25),
    };
  }

  return {
    valid: true,
    trimmedName: cleaned,
  };
}

let activeProfile: PlayerProfile | null = null;
let pagePlayerId: string | null = null;

export function removeSavedLogin(): void {
  for (const storageName of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = globalThis[storageName];
      for (const key of [STORAGE_KEY_ACTIVE_PLAYER, STORAGE_KEY_PLAYER_ID, STORAGE_KEY_PLAYER_NAME, STORAGE_KEY_ALL_PLAYERS]) storage?.removeItem(key);
    } catch { /* Storage may be blocked; in-memory login still works. */ }
  }
}
removeSavedLogin();
// A browser Back restoration must not bring an earlier logged-in page back.
if (typeof window !== 'undefined') window.addEventListener('pageshow', event => {
  if (event.persisted) window.location.reload();
});

export function getPlayerName(fallbackName?: string): string {
  return activeProfile?.name || fallbackName?.trim() || '';
}
export function getPlayerId(fallbackId?: string): string {
  return activeProfile?.id || fallbackId?.trim() || getOrCreatePlayerId();
}
export function getOrCreatePlayerId(): string {
  return activeProfile?.id || (pagePlayerId ??= generateUuid());
}
export function loadActivePlayer(): PlayerProfile | null {
  return activeProfile ? { ...activeProfile } : null;
}
export function clearActivePlayer(): void {
  activeProfile = null;
  pagePlayerId = null;
  removeSavedLogin();
}

export function maskPlayerName(name: string): string {
  return name.trim().split(/\s+/).map(word => {
    const chars = Array.from(word);
    return chars.length <= 2 ? (chars[0] || '') + '*' : chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
  }).join(' ');
}

/** Retain only the current page's authenticated identity; never retain the PIN. */
export function saveActivePlayer(profile: PlayerProfile): void {
  if (activeProfile && activeProfile.sessionToken !== profile.sessionToken) throw new Error('Log out before changing profile.');
  const validation = validatePlayerName(profile.name);
  activeProfile = {
    id: profile.id, name: validation.trimmedName || profile.name.trim(),
    createdAt: profile.createdAt, kind: profile.kind, sessionToken: profile.sessionToken,
  };
  removeSavedLogin();
}
export function loadAllLocalPlayers(): PlayerProfile[] { return []; }
export function createPlayerProfile(name: string, explicitId?: string): PlayerProfile {
  const profile: PlayerProfile = { id: explicitId || getOrCreatePlayerId(), name: validatePlayerName(name).trimmedName, createdAt: Date.now() };
  saveActivePlayer(profile);
  return loadActivePlayer()!;
}
