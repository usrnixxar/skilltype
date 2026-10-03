/**
 * SkillType Shared Leaderboard API Client
 * Supports direct Supabase cloud integration with realtime updates
 * and seamless fallback to backend /api routes and local emulation.
 */

import { getSupabaseClient } from './supabaseClient';
import { getDayId, getWeekId } from './dateUtils';
import { sanitizePlayerName } from './playerProfile';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  runId?: string;
  playerId: string;
  playerName: string;
  points: number;
  weeklyPoints: number;
  dailyPoints: number;
  totalPoints: number;
  score?: number;
  bestWpm: number;
  wpm?: number;
  bestAccuracy: number;
  accuracy?: number;
  gamesPlayed: number;
  lastScore: number;
  lastPlayedAt: number;
  completedAt?: number;
  weekId: string;
  dayId: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalEligible: number;
  serverTime: number;
  weekId?: string;
  dayId?: string;
  type?: 'weekly' | 'daily';
  playerRank: LeaderboardEntry | null;
}

export interface SubmitRunPayload {
  gameSessionId?: string;
  runId?: string;
  playerId: string;
  playerName: string;
  wpm: number;
  score: number;
  accuracy: number;
  wave?: number;
  wordsCompleted?: number;
  durationSeconds?: number;
}

export interface SubmitRunResult {
  success: boolean;
  alreadyRecorded?: boolean;
  sessionId?: string;
  runId?: string;
  completedAt?: number;
  error?: string;
  record?: any;
}

/**
 * Compare two leaderboard entries according to official SkillType weekly leaderboard ranking rules:
 * 1. Highest Points first (weekly_points or score)
 * 2. If Points tie -> highest Best WPM
 * 3. If WPM ties -> highest Best Accuracy
 * 4. If still tied -> earlier run first (last_played_at ASC)
 */
export function compareLeaderboardRuns(
  a: {
    points?: number;
    weeklyPoints?: number;
    weekly_points?: number;
    score?: number;
    wpm?: number;
    bestWpm?: number;
    best_wpm?: number;
    accuracy?: number;
    bestAccuracy?: number;
    best_accuracy?: number;
    completedAt?: number;
    lastPlayedAt?: number;
    last_played_at?: number;
  },
  b: {
    points?: number;
    weeklyPoints?: number;
    weekly_points?: number;
    score?: number;
    wpm?: number;
    bestWpm?: number;
    best_wpm?: number;
    accuracy?: number;
    bestAccuracy?: number;
    best_accuracy?: number;
    completedAt?: number;
    lastPlayedAt?: number;
    last_played_at?: number;
  }
): number {
  const pointsA = Number(a.points ?? a.weeklyPoints ?? a.weekly_points ?? a.score ?? 0);
  const pointsB = Number(b.points ?? b.weeklyPoints ?? b.weekly_points ?? b.score ?? 0);
  if (pointsB !== pointsA) return pointsB - pointsA;

  const wpmA = Number(a.bestWpm ?? a.best_wpm ?? a.wpm ?? 0);
  const wpmB = Number(b.bestWpm ?? b.best_wpm ?? b.wpm ?? 0);
  if (wpmB !== wpmA) return wpmB - wpmA;

  const accA = Number(a.bestAccuracy ?? a.best_accuracy ?? a.accuracy ?? 0);
  const accB = Number(b.bestAccuracy ?? b.best_accuracy ?? b.accuracy ?? 0);
  if (accB !== accA) return accB - accA;

  const timeA = Number(a.lastPlayedAt ?? a.last_played_at ?? a.completedAt ?? 0);
  const timeB = Number(b.lastPlayedAt ?? b.last_played_at ?? b.completedAt ?? 0);
  return timeA - timeB;
}

/**
 * Fetch leaderboard data (weekly or daily) from Supabase or persistent backend.
 */
export async function fetchWeeklyLeaderboard(
  playerId?: string,
  type: 'weekly' | 'daily' = 'weekly',
  idOverride?: string
): Promise<LeaderboardResponse> {
  const supabase = getSupabaseClient();

  // 1. If Supabase is configured in frontend environment, try direct cloud fetch
  if (supabase) {
    try {
      const now = Date.now();
      const targetWeekId = type === 'weekly' ? idOverride || getWeekId(now) : undefined;
      const targetDayId = type === 'daily' ? idOverride || getDayId(now) : undefined;

      let query = supabase.from('leaderboard').select('*');

      if (type === 'daily' && targetDayId) {
        query = query.eq('day_id', targetDayId).gt('daily_points', 0);
        query = query
          .order('daily_points', { ascending: false })
          .order('best_wpm', { ascending: false })
          .order('best_accuracy', { ascending: false })
          .order('last_played_at', { ascending: true });
      } else if (targetWeekId) {
        query = query.eq('week_id', targetWeekId);
        query = query
          .order('weekly_points', { ascending: false })
          .order('best_wpm', { ascending: false })
          .order('best_accuracy', { ascending: false })
          .order('last_played_at', { ascending: true });
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        let playerRankEntry: LeaderboardEntry | null = null;
        const entries: LeaderboardEntry[] = data.map((row: any, index: number) => {
          const points = type === 'daily' ? Number(row.daily_points) : Number(row.weekly_points);
          const entry: LeaderboardEntry = {
            rank: index + 1,
            id: row.id,
            runId: row.id,
            playerId: row.player_id,
            playerName: row.player_name,
            points,
            weeklyPoints: Number(row.weekly_points),
            dailyPoints: Number(row.daily_points),
            totalPoints: Number(row.total_points),
            score: points,
            bestWpm: Number(row.best_wpm),
            wpm: Number(row.best_wpm),
            bestAccuracy: Number(row.best_accuracy),
            accuracy: Number(row.best_accuracy),
            gamesPlayed: Number(row.games_played),
            lastScore: Number(row.last_score),
            lastPlayedAt: Number(row.last_played_at),
            completedAt: Number(row.last_played_at),
            weekId: row.week_id,
            dayId: row.day_id,
          };

          if (playerId && row.player_id === playerId) {
            playerRankEntry = entry;
          }
          return entry;
        });

        return {
          entries,
          totalEligible: entries.length,
          serverTime: now,
          weekId: targetWeekId,
          dayId: targetDayId,
          type,
          playerRank: playerRankEntry,
        };
      }
    } catch (err) {
      console.warn('[Leaderboard] Supabase direct query failed, falling back to /api:', err);
    }
  }

  // 2. Fetch via Backend API
  const url = new URL('/api/leaderboard', window.location.origin);
  if (playerId) url.searchParams.set('playerId', playerId);
  url.searchParams.set('type', type);
  if (idOverride) {
    if (type === 'daily') url.searchParams.set('dayId', idOverride);
    else url.searchParams.set('weekId', idOverride);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Leaderboard fetch failed with status ${res.status}`);
  }

  return (await res.json()) as LeaderboardResponse;
}

/**
 * Submit a completed run to Supabase and/or persistent backend.
 * Guarantees idempotent once-per-game submission using gameSessionId.
 */
export async function submitGameRun(
  payload: SubmitRunPayload
): Promise<SubmitRunResult> {
  const sessionId = (payload.gameSessionId || payload.runId || '').trim();
  const safeName = sanitizePlayerName(payload.playerName);

  const cleanPayload = {
    ...payload,
    gameSessionId: sessionId,
    runId: sessionId,
    playerName: safeName,
    score: Math.max(0, Math.round(Number(payload.score) || 0)),
    wpm: Math.max(0, Math.min(400, Math.round(Number(payload.wpm) || 0))),
    accuracy: Math.max(0, Math.min(100, Math.round(Number(payload.accuracy) || 0))),
  };

  const supabase = getSupabaseClient();

  // 1. If Supabase client configured, attempt direct submission / RPC
  if (supabase) {
    try {
      const now = Date.now();
      const weekId = getWeekId(now);
      const dayId = getDayId(now);

      const { data, error } = await supabase.rpc('submit_game_score', {
        p_session_id: sessionId,
        p_player_id: cleanPayload.playerId,
        p_player_name: cleanPayload.playerName,
        p_score: cleanPayload.score,
        p_wpm: cleanPayload.wpm,
        p_accuracy: cleanPayload.accuracy,
        p_week_id: weekId,
        p_day_id: dayId,
      });

      if (!error && data) {
        return {
          success: true,
          alreadyRecorded: Boolean(data.alreadyRecorded),
          sessionId,
          runId: sessionId,
          completedAt: now,
          record: data.record,
        };
      }
    } catch (err) {
      console.warn('[SubmitRun] Supabase direct RPC failed, trying API route:', err);
    }
  }

  // 2. Submit to Backend API
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(cleanPayload),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Run submission failed with status ${res.status}`);
  }

  return (await res.json()) as SubmitRunResult;
}

/**
 * Register or update player display name on the server.
 */
export async function registerPlayerWithServer(
  id: string,
  name: string
): Promise<void> {
  const safeName = sanitizePlayerName(name);
  if (!id || safeName.length < 2) return;

  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const now = Date.now();
      await supabase
        .from('players')
        .upsert({ id, name: safeName, created_at: now, last_seen_at: now });
    }
  } catch {}

  try {
    await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: safeName }),
    });
  } catch (err) {
    console.warn('Failed to register player profile with server:', err);
  }
}
