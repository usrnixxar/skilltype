/**
 * SkillType Shared Leaderboard API Client
 * Connects to the persistent backend for live rankings, run submissions, and player synchronization.
 */

export interface LeaderboardEntry {
  rank: number;
  runId: string;
  playerId: string;
  playerName: string;
  wpm: number;
  score: number;
  accuracy: number;
  wave: number;
  wordsCompleted: number;
  durationSeconds: number;
  completedAt: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalEligible: number;
  serverTime: number;
  playerRank: LeaderboardEntry | null;
}

export interface SubmitRunPayload {
  runId: string;
  playerId: string;
  playerName: string;
  wpm: number;
  score: number;
  accuracy: number;
  wave: number;
  wordsCompleted: number;
  durationSeconds: number;
}

export interface SubmitRunResult {
  success: boolean;
  alreadyRecorded?: boolean;
  runId?: string;
  completedAt?: number;
  error?: string;
}

/**
 * Compare two runs according to official SkillType weekly leaderboard ranking rules:
 * 1. Higher WPM ranks first
 * 2. If WPM equal, higher Score ranks first
 * 3. If both match, higher Accuracy ranks first
 * 4. If still tied, earlier completed run ranks first (completedAt ASC)
 */
export function compareLeaderboardRuns(
  a: { wpm: number; score: number; accuracy: number; completedAt: number },
  b: { wpm: number; score: number; accuracy: number; completedAt: number }
): number {
  if (b.wpm !== a.wpm) return b.wpm - a.wpm;
  if (b.score !== a.score) return b.score - a.score;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  return a.completedAt - b.completedAt;
}

/**
 * Fetch the rolling 7-day weekly leaderboard from the persistent backend.
 */
export async function fetchWeeklyLeaderboard(
  playerId?: string
): Promise<LeaderboardResponse> {
  const url = new URL('/api/leaderboard', window.location.origin);
  if (playerId) {
    url.searchParams.set('playerId', playerId);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
    // Don't cache leaderboard responses so they are always live
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Leaderboard fetch failed with status ${res.status}`);
  }

  return (await res.json()) as LeaderboardResponse;
}

/**
 * Submit a completed run to the server.
 * Timestamp is generated on the server for security and rolling-window integrity.
 */
export async function submitGameRun(
  payload: SubmitRunPayload
): Promise<SubmitRunResult> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
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
  try {
    await fetch('/api/players', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, name }),
    });
  } catch (err) {
    console.warn('Failed to register player profile with server:', err);
  }
}
