/**
 * Player Profile Management for SkillType
 * Provides guest profiles with unique IDs to support shared coaching-center computers.
 */

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: number;
}

const STORAGE_KEY_ACTIVE_PLAYER = 'skilltype_active_player';
const STORAGE_KEY_ALL_PLAYERS = 'skilltype_local_players';

/**
 * Validate display name:
 * - Trimmed length between 2 and 24 characters
 * - Allows letters, numbers, spaces, and safe punctuation
 */
export function validatePlayerName(name: string): {
  valid: boolean;
  error?: string;
  trimmedName: string;
} {
  const trimmed = (name || '').trim();

  if (trimmed.length < 2) {
    return {
      valid: false,
      error: 'Name must be at least 2 characters long.',
      trimmedName: trimmed,
    };
  }

  if (trimmed.length > 24) {
    return {
      valid: false,
      error: 'Name must be 24 characters or fewer.',
      trimmedName: trimmed.substring(0, 24),
    };
  }

  return {
    valid: true,
    trimmedName: trimmed,
  };
}

/**
 * Generate a unique ID for a new guest player profile.
 * Format: usr_<timestamp_base36>_<random_hex>
 */
export function generatePlayerId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `usr_${ts}_${rand}`;
}

/**
 * Load the active player profile from browser localStorage.
 */
export function loadActivePlayer(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_PLAYER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse active player profile:', err);
  }
  return null;
}

/**
 * Save active player profile to localStorage and remember in local history.
 */
export function saveActivePlayer(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PLAYER, JSON.stringify(profile));

    // Also update all local profiles
    const all = loadAllLocalPlayers();
    const existingIndex = all.findIndex((p) => p.id === profile.id);
    if (existingIndex >= 0) {
      all[existingIndex] = profile;
    } else {
      all.unshift(profile);
    }
    localStorage.setItem(STORAGE_KEY_ALL_PLAYERS, JSON.stringify(all.slice(0, 20)));
  } catch (err) {
    console.warn('Failed to persist active player profile:', err);
  }
}

/**
 * Load all player profiles known to this browser.
 * Enables quick switching between students on shared computers.
 */
export function loadAllLocalPlayers(): PlayerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALL_PLAYERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (p) => p && typeof p.id === 'string' && typeof p.name === 'string'
      );
    }
  } catch (err) {
    console.warn('Failed to load local players list:', err);
  }
  return [];
}

/**
 * Create a new guest player profile with a fresh unique ID.
 * Identical names entered by different students will NEVER merge because of distinct IDs.
 */
export function createPlayerProfile(name: string): PlayerProfile {
  const { trimmedName } = validatePlayerName(name);
  const profile: PlayerProfile = {
    id: generatePlayerId(),
    name: trimmedName,
    createdAt: Date.now(),
  };

  saveActivePlayer(profile);
  return profile;
}
