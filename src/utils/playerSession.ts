import { getSupabaseClient } from './supabaseClient';
import { PlayerProfile, clearActivePlayer, loadActivePlayer, saveActivePlayer } from './playerProfile';

const DEVICE_KEY = 'skilltype_device_id';

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && /^[a-f0-9-]{20,80}$/.test(existing)) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export class SessionConflictError extends Error {
  code = 'ACTIVE_ON_OTHER_DEVICE';
  constructor(message = 'This account is already logged in on another device.') {
    super(message);
    this.name = 'SessionConflictError';
  }
}

async function sessionRequest(body: Record<string, unknown>) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Login service is not configured. Please contact your teacher.');

  const { data, error } = await client.functions.invoke('player-session', { body });

  if (error || !data?.success) {
    let payload: any = data || null;

    if (error?.context instanceof Response) {
      payload = await error.context.json().catch(() => payload || {});
    }

    if (payload?.code === 'ACTIVE_ON_OTHER_DEVICE') {
      throw new SessionConflictError(payload?.error);
    }

    throw new Error(payload?.error || 'Unable to connect. Please retry.');
  }

  return data;
}

export interface CheaterEntry {
  name: string;
  distinctIpCount: number;
  flaggedAt: string | null;
}

export async function fetchCheaters(): Promise<CheaterEntry[]> {
  const data = await sessionRequest({ action: 'cheaters' });
  return Array.isArray(data.cheaters) ? data.cheaters : [];
}

export async function loginPlayer(
  kind: 'student' | 'guest',
  name: string,
  pin: string,
  forceLogoutOther = false
): Promise<PlayerProfile> {
  if (loadActivePlayer()) throw new Error('Log out before changing profile.');

  const data = await sessionRequest({
    action: 'login',
    kind,
    name,
    pin,
    deviceId: getOrCreateDeviceId(),
    forceLogoutOther,
  });

  try {
    saveActivePlayer(data.profile);
  } catch (error) {
    await sessionRequest({
      action: 'logout',
      sessionToken: data.profile.sessionToken,
    }).catch(() => {});
    throw error;
  }

  return data.profile;
}

export async function validatePlayerSession(profile: PlayerProfile): Promise<boolean> {
  if (!profile.sessionToken) return false;

  try {
    await sessionRequest({
      action: 'validate',
      sessionToken: profile.sessionToken,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/please log in again|session expired|invalid session|unauthorized/i.test(message)) {
      return false;
    }
    throw error;
  }
}

export async function logoutPlayer(profile: PlayerProfile): Promise<void> {
  await sessionRequest({ action: 'logout', sessionToken: profile.sessionToken });
  clearActivePlayer();
}
