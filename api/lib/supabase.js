import { createClient } from '@supabase/supabase-js';
import { getDayId, getWeekId } from './dateUtils.js';

function config() {
  return {
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    key: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  };
}
export function isSupabaseBackendConfigured() {
  const { url, key } = config();
  return Boolean(url && key);
}
function client() {
  const { url, key } = config();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function submitSupabaseRun(payload) {
  const { data, error } = await client().functions.invoke('submit-score', { body: payload });
  if (error || data?.success !== true) {
    const failure = new Error('Score could not be saved. Please retry.');
    failure.statusCode = 503;
    throw failure;
  }
  return data;
}
export async function fetchSupabaseLeaderboard(playerId, type, override) {
  const now = Date.now();
  const daily = type === 'daily';
  const period = override || (daily ? getDayId(now) : getWeekId(now));
  const pointsKey = daily ? 'daily_points' : 'weekly_points';
  let query = client().from('leaderboard').select('*')
    .eq(daily ? 'day_id' : 'week_id', period)
    .order(pointsKey, { ascending: false })
    .order('best_wpm', { ascending: false })
    .order('best_accuracy', { ascending: false })
    .order('last_played_at', { ascending: true });
  if (daily) query = query.gt('daily_points', 0);
  const { data, error } = await query;
  if (error) throw new Error('Leaderboard is temporarily unavailable.');
  const entries = data.map((row, index) => ({
    rank: index + 1, id: row.id, runId: row.id,
    playerId: row.player_id, player_id: row.player_id,
    playerName: row.player_name, player_name: row.player_name, name: row.player_name,
    points: Number(row[pointsKey]), score: Number(row[pointsKey]),
    weeklyPoints: Number(row.weekly_points), dailyPoints: Number(row.daily_points), totalPoints: Number(row.total_points),
    bestWpm: Number(row.best_wpm), wpm: Number(row.best_wpm),
    bestAccuracy: Number(row.best_accuracy), accuracy: Number(row.best_accuracy),
    gamesPlayed: Number(row.games_played), lastScore: Number(row.last_score),
    lastPlayedAt: Date.parse(row.last_played_at), completedAt: Date.parse(row.last_played_at),
    weekId: row.week_id, dayId: row.day_id,
  }));
  return {
    entries, totalEligible: entries.length, serverTime: now, type,
    ...(daily ? { dayId: period } : { weekId: period }),
    playerRank: entries.find(entry => entry.playerId === playerId) || null,
  };
}
