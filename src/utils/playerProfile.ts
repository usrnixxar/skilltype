/**
 * Player Profile and Identity Management for SkillType
 *
 * Requirements:
 * - Mandatory player name (2–25 characters, trimmed).
 * - Persistent unique player_id stored in localStorage (`skilltype_player_id`).
 * - Same player_id reused across sessions so scores accumulate without duplicates.
 * - Player name can be updated at any time.
 * - Never defaults to "Guest", "Unknown", "undefined", "null", or "Player 1".
 */

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: number;
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

/**
 * Get the permanent player_id from localStorage, or generate a fresh UUID and store it.
 */
export function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY_PLAYER_ID);
    if (existing && existing.trim()) {
      return existing.trim();
    }

    // Check if legacy profile has an ID
    const legacy = localStorage.getItem(STORAGE_KEY_ACTIVE_PLAYER);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (parsed?.id && typeof parsed.id === 'string' && parsed.id.trim()) {
          const id = parsed.id.trim();
          localStorage.setItem(STORAGE_KEY_PLAYER_ID, id);
          return id;
        }
      } catch {}
    }

    const newId = generateUuid();
    localStorage.setItem(STORAGE_KEY_PLAYER_ID, newId);
    return newId;
  } catch {
    return generateUuid();
  }
}

/**
 * Load the active player profile from browser localStorage.
 * Returns null if no valid name has been entered yet.
 */
export function loadActivePlayer(): PlayerProfile | null {
  try {
    const storedId = localStorage.getItem(STORAGE_KEY_PLAYER_ID);
    const storedName = localStorage.getItem(STORAGE_KEY_PLAYER_NAME);

    if (storedName && storedName.trim()) {
      const validation = validatePlayerName(storedName);
      if (validation.valid) {
        const id = storedId && storedId.trim() ? storedId.trim() : getOrCreatePlayerId();
        return {
          id,
          name: validation.trimmedName,
          createdAt: Date.now(),
        };
      }
    }

    // Legacy check
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_PLAYER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string') {
        const validation = validatePlayerName(parsed.name);
        if (validation.valid) {
          const id = parsed.id && typeof parsed.id === 'string' ? parsed.id : getOrCreatePlayerId();
          localStorage.setItem(STORAGE_KEY_PLAYER_ID, id);
          localStorage.setItem(STORAGE_KEY_PLAYER_NAME, validation.trimmedName);
          return {
            id,
            name: validation.trimmedName,
            createdAt: Number(parsed.createdAt) || Date.now(),
          };
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load active player profile:', err);
  }
  return null;
}

/**
 * Save active player profile to localStorage.
 * Stores under skilltype_player_id, skilltype_player_name, and skilltype_active_player.
 */
export function saveActivePlayer(profile: PlayerProfile): void {
  try {
    const validation = validatePlayerName(profile.name);
    const safeName = validation.trimmedName || profile.name.trim();

    localStorage.setItem(STORAGE_KEY_PLAYER_ID, profile.id);
    localStorage.setItem(STORAGE_KEY_PLAYER_NAME, safeName);
    localStorage.setItem(
      STORAGE_KEY_ACTIVE_PLAYER,
      JSON.stringify({ ...profile, name: safeName })
    );

    // Keep recent local profiles for switching on shared computers
    const all = loadAllLocalPlayers();
    const existingIndex = all.findIndex((p) => p.id === profile.id);
    const updatedProfile = { ...profile, name: safeName };

    if (existingIndex >= 0) {
      all[existingIndex] = updatedProfile;
    } else {
      all.unshift(updatedProfile);
    }
    localStorage.setItem(STORAGE_KEY_ALL_PLAYERS, JSON.stringify(all.slice(0, 20)));
  } catch (err) {
    console.warn('Failed to persist active player profile:', err);
  }
}

/**
 * Load all player profiles known to this browser.
 */
export function loadAllLocalPlayers(): PlayerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALL_PLAYERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim().length >= 2
      );
    }
  } catch (err) {
    console.warn('Failed to load local players list:', err);
  }
  return [];
}

/**
 * Create or update a player profile with a validated name.
 * Uses existing player_id if available so scores accumulate safely.
 */
export function createPlayerProfile(name: string, explicitId?: string): PlayerProfile {
  const { trimmedName } = validatePlayerName(name);
  const id = explicitId || getOrCreatePlayerId();
  const profile: PlayerProfile = {
    id,
    name: trimmedName,
    createdAt: Date.now(),
  };

  saveActivePlayer(profile);
  return profile;
}
