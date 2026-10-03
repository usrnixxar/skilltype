import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable lookup (Vite frontend or Node environment)
function getEnv(key: string): string {
  try {
    const meta = import.meta as any;
    if (meta && meta.env && meta.env[key]) {
      return String(meta.env[key]);
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]);
    }
  } catch {}
  return '';
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

let supabaseInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseInstance;
}

/**
 * Subscribe to realtime updates on the 'leaderboard' table.
 * Automatically notifies callback when any player finishes a game on any device.
 */
export function subscribeToLeaderboardRealtime(onChange: () => void): (() => void) | null {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('skilltype_leaderboard_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard' },
        () => {
          onChange();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase Realtime] Could not subscribe:', err);
    return null;
  }
}
