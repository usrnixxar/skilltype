/**
 * SkillType Shared Leaderboard API Client
 * Supports direct Supabase cloud integration with realtime updates
 * and seamless fallback to backend /api routes and local emulation.
 */

import { getSupabaseClient } from './supabaseClient';
import { getDayId, getWeekId } from './dateUtils';
import { sanitizePlayerName } from './playerProfile';

export interface LeaderboardEntry {
  playerType?: 'student' | 'guest';
  rank: number;
  id: string;
  runId?: string;
  playerId: string;
  player_id?: string;
  playerName: string;
  player_name?: string;
  name?: string;
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
  sessionToken?: string;
  gameSessionId?: string;
  runId?: string;
  playerId: string;
  player_id?: string;
  playerName: string;
  player_name?: string;
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

      // Step 6: Fetch explicitly includes player_name
      let query = supabase.from('leaderboard').select(
        'id, player_id, player_name, player_type, total_points, weekly_points, daily_points, best_wpm, best_accuracy, games_played, last_score, created_at, updated_at, last_played_at, week_id, day_id'
      );

      if (type === 'daily' && targetDayId) {
        query = query.eq('day_id', targetDayId);
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
          const safeName = (row.player_name || row.playerName || row.name || '').trim() || 'Unnamed Player';
          const pId = row.player_id || row.playerId || '';

          const entry: LeaderboardEntry = {
            playerType: row.player_type,
            rank: index + 1,
            id: row.id,
            runId: row.id,
            playerId: pId,
            player_id: pId,
            playerName: safeName,
            player_name: safeName,
            name: safeName,
            points,
            weeklyPoints: Number(row.weekly_points || 0),
            dailyPoints: Number(row.daily_points || 0),
            totalPoints: Number(row.total_points || 0),
            score: points,
            bestWpm: Number(row.best_wpm || 0),
            wpm: Number(row.best_wpm || 0),
            bestAccuracy: Number(row.best_accuracy || 0),
            accuracy: Number(row.best_accuracy || 0),
            gamesPlayed: Number(row.games_played || 0),
            lastScore: Number(row.last_score || 0),
            lastPlayedAt: Number(new Date(row.last_played_at).getTime() || row.last_played_at || 0),
            completedAt: Number(new Date(row.last_played_at).getTime() || row.last_played_at || 0),
            weekId: row.week_id,
            dayId: row.day_id,
          };

          if (playerId && (pId === playerId || row.player_id === playerId)) {
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

  const responseJson = (await res.json()) as LeaderboardResponse;
  if (responseJson && Array.isArray(responseJson.entries)) {
    responseJson.entries = responseJson.entries.map((entry: any, index: number) => {
      const safeName = (entry.player_name || entry.playerName || entry.name || '').trim() || 'Unnamed Player';
      const pId = entry.player_id || entry.playerId || '';
      return {
        ...entry,
        rank: entry.rank ?? index + 1,
        playerId: pId,
        player_id: pId,
        playerName: safeName,
        player_name: safeName,
        name: safeName,
      };
    });
  }

  return responseJson;
}

/**
 * Submit a completed run to Supabase and/or persistent backend.
 * Guarantees idempotent once-per-game submission using gameSessionId.
 */
export async function submitGameRun(
  payload: SubmitRunPayload
): Promise<SubmitRunResult> {
  const sessionId = (payload.gameSessionId || payload.runId || '').trim();
  const rawName = payload.playerName || payload.player_name || '';
  const safeName = sanitizePlayerName(rawName);
  const safePlayerId = (payload.playerId || payload.player_id || '').trim();

  const cleanPayload = {
    ...payload,
    gameSessionId: sessionId,
    runId: sessionId,
    playerId: safePlayerId,
    player_id: safePlayerId,
    playerName: safeName,
    player_name: safeName,
    score: Math.max(0, Math.round(Number(payload.score) || 0)),
    wpm: Math.max(0, Math.min(400, Math.round(Number(payload.wpm) || 0))),
    accuracy: Math.max(0, Math.min(100, Math.round(Number(payload.accuracy) || 0))),
  };

  const now = Date.now();

  const supabase = getSupabaseClient();
  if (supabase) {
    // The Edge Function validates guest scores, then commits the name and
    // score atomically. Never fall back to unrestricted browser table writes.
    const { data, error } = await supabase.functions.invoke('submit-score', {
      body: cleanPayload,
    });
    if (error || data?.success !== true) {
      throw new Error(data?.error || 'Could not save your leaderboard score. Please retry.');
    }
    return {
      ...data,
      success: true,
      sessionId,
      runId: sessionId,
      completedAt: data.completedAt || now,
    };
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

  const result = (await res.json()) as SubmitRunResult;
  if (result.success !== true) throw new Error(result.error || 'Score was not saved.');
  return result;
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

  // Supabase persists the profile together with the first completed run.
  if (getSupabaseClient()) return;

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
