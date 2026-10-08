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
async function sessionRequest(body: Record<string, unknown>) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Login service is not configured. Please contact your teacher.');
  const { data, error } = await client.functions.invoke('player-session', { body });
  if (error || !data?.success) {
    let message = data?.error;
    if (!message && error?.context instanceof Response) {
      message = (await error.context.json().catch(() => ({}))).error;
    }
    throw new Error(message || 'Unable to connect. Please retry.');
  }
  return data;
}
export interface CheaterEntry { name: string; distinctIpCount: number; flaggedAt: string | null; }

export async function fetchCheaters(): Promise<CheaterEntry[]> {
  const data = await sessionRequest({ action: 'cheaters' });
  return Array.isArray(data.cheaters) ? data.cheaters : [];
}

export async function loginPlayer(kind: 'student' | 'guest', name: string, pin: string): Promise<PlayerProfile> {
  if (loadActivePlayer()) throw new Error('Log out before changing profile.');
  const data = await sessionRequest({ action: 'login', kind, name, pin, deviceId: getOrCreateDeviceId() });
  try { saveActivePlayer(data.profile); }
  catch (error) {
    await sessionRequest({ action: 'logout', sessionToken: data.profile.sessionToken }).catch(() => {});
    throw error;
  }
  return data.profile;
}
export async function logoutPlayer(profile: PlayerProfile): Promise<void> {
  await sessionRequest({ action: 'logout', sessionToken: profile.sessionToken });
  clearActivePlayer();
}
