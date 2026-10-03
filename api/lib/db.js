import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { getKolkataComponents, getDayId, getWeekId } from './dateUtils.js';

/**
 * Sanitize and validate player display name (2–25 characters, strip HTML & control chars).
 */
export function sanitizePlayerName(name) {
  if (typeof name !== 'string') return '';
  const cleaned = name
    .replace(/<[^>]*>?/gm, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
  return cleaned.substring(0, 25);
}

/**
 * Generate standard UUID
 */
export function generateUuid() {
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
 * Compare two leaderboard entries according to official SkillType rules:
 * 1. Highest Points first (weekly_points or daily_points)
 * 2. If Points tie -> highest Best WPM
 * 3. If WPM ties -> highest Best Accuracy
 * 4. If still tied -> earlier completed run first (last_played_at ASC)
 */
export function compareLeaderboardEntries(a, b, pointsKey = 'weekly_points') {
  const pointsA = Number(a[pointsKey] ?? a.weekly_points ?? a.weeklyPoints ?? 0);
  const pointsB = Number(b[pointsKey] ?? b.weekly_points ?? b.weeklyPoints ?? 0);
  if (pointsB !== pointsA) return pointsB - pointsA;

  const wpmA = Number(a.best_wpm ?? a.bestWpm ?? a.wpm ?? 0);
  const wpmB = Number(b.best_wpm ?? b.bestWpm ?? b.wpm ?? 0);
  if (wpmB !== wpmA) return wpmB - wpmA;

  const accA = Number(a.best_accuracy ?? a.bestAccuracy ?? a.accuracy ?? 0);
  const accB = Number(b.best_accuracy ?? b.bestAccuracy ?? b.accuracy ?? 0);
  if (accB !== accA) return accB - accA;

  const timeA = Number(a.last_played_at ?? a.lastPlayedAt ?? a.completedAt ?? 0);
  const timeB = Number(b.last_played_at ?? b.lastPlayedAt ?? b.completedAt ?? 0);
  return timeA - timeB;
}

// Backwards-compatibility alias for test suites
export function compareRuns(a, b) {
  // If runs have points/weekly_points/score
  if (a.weekly_points !== undefined || b.weekly_points !== undefined) {
    return compareLeaderboardEntries(a, b, 'weekly_points');
  }
  // If comparing by score
  if (b.score !== undefined && a.score !== undefined && b.score !== a.score) {
    return b.score - a.score;
  }
  const wpmA = a.wpm ?? a.best_wpm ?? 0;
  const wpmB = b.wpm ?? b.best_wpm ?? 0;
  if (wpmB !== wpmA) return wpmB - wpmA;

  const accA = a.accuracy ?? a.best_accuracy ?? 0;
  const accB = b.accuracy ?? b.best_accuracy ?? 0;
  if (accB !== accA) return accB - accA;

  const timeA = a.completedAt ?? a.last_played_at ?? 0;
  const timeB = b.completedAt ?? b.last_played_at ?? 0;
  return timeA - timeB;
}

// In-memory persistent emulation for dev/testing when no cloud DB connection is provided
const memoryPlayers = new Map();
const memoryLeaderboard = new Map(); // key: `${player_id}_${week_id}`
const memorySessions = new Map(); // key: session_id
const memoryLifetimePoints = new Map(); // key: player_id

export function resetInMemoryDatabase() {
  memoryPlayers.clear();
  memoryLeaderboard.clear();
  memorySessions.clear();
  memoryLifetimePoints.clear();
}

let cachedSqlClient = null;
let schemaInitPromise = null;

function getConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    ''
  );
}

export function isCloudDatabaseConfigured() {
  return Boolean(getConnectionString());
}

function getSqlClient() {
  const connStr = getConnectionString();
  if (!connStr) return null;

  if (!cachedSqlClient) {
    cachedSqlClient = neon(connStr);
  }
  return cachedSqlClient;
}

async function ensureCloudSchema(sql) {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      // 1. Players table
      await sql`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          last_seen_at BIGINT NOT NULL
        );
      `;

      // 2. Leaderboard table matching exact specification
      await sql`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          player_name TEXT NOT NULL,
          total_points INTEGER NOT NULL DEFAULT 0,
          best_wpm NUMERIC NOT NULL DEFAULT 0,
          best_accuracy NUMERIC NOT NULL DEFAULT 0,
          games_played INTEGER NOT NULL DEFAULT 0,
          daily_points INTEGER NOT NULL DEFAULT 0,
          weekly_points INTEGER NOT NULL DEFAULT 0,
          last_score INTEGER NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          last_played_at BIGINT NOT NULL,
          week_id TEXT NOT NULL,
          day_id TEXT NOT NULL,
          CONSTRAINT uq_player_week UNIQUE (player_id, week_id)
        );
      `;

      // 3. Game sessions table for duplicate submission prevention
      await sql`
        CREATE TABLE IF NOT EXISTS game_sessions (
          session_id TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          score INTEGER NOT NULL,
          created_at BIGINT NOT NULL
        );
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_lb_week_points ON leaderboard(week_id, weekly_points DESC, best_wpm DESC);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_lb_day_points ON leaderboard(day_id, daily_points DESC, best_wpm DESC);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_lb_player_id ON leaderboard(player_id);`;
    })();
  }
  return schemaInitPromise;
}

/**
 * Register or update player profile.
 */
export async function upsertPlayer(id, name) {
  const safeId = typeof id === 'string' ? id.trim() : '';
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 25) {
    throw new Error('Invalid player ID or name (name must be 2–25 characters)');
  }
  const safeName = sanitizePlayerName(name);
  if (!safeId || safeName.length < 2 || safeName.length > 25) {
    throw new Error('Invalid player ID or name (name must be 2–25 characters)');
  }

  const now = Date.now();
  const sql = getSqlClient();

  if (sql) {
    await ensureCloudSchema(sql);
    const rows = await sql`
      INSERT INTO players (id, name, created_at, last_seen_at)
      VALUES (${safeId}, ${safeName}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        last_seen_at = EXCLUDED.last_seen_at
      RETURNING id, name, created_at, last_seen_at;
    `;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      createdAt: Number(row.created_at),
      lastSeenAt: Number(row.last_seen_at),
    };
  }

  // In-memory fallback
  const existing = memoryPlayers.get(safeId);
  if (existing) {
    existing.name = safeName;
    existing.lastSeenAt = now;
    return { ...existing };
  } else {
    const newPlayer = {
      id: safeId,
      name: safeName,
      createdAt: now,
      lastSeenAt: now,
    };
    memoryPlayers.set(safeId, newPlayer);
    return { ...newPlayer };
  }
}

/**
 * Record a completed game run with safe atomic UPSERT logic:
 * - Prevents duplicate writes with gameSessionId
 * - Automatically computes week_id (Saturday 11:59 PM IST reset) and day_id in Asia/Kolkata
 * - Accumulates weekly_points = previous + current
 * - Accumulates daily_points = sum of today's points
 * - Best WPM = MAX(previous_best_wpm, current_wpm)
 * - Best Accuracy = MAX(previous_best_accuracy, current_accuracy)
 */
export async function recordCompletedRun(runData) {
  const {
    runId,
    gameSessionId,
    sessionId,
    playerId,
    player_id,
    playerName,
    player_name,
    name,
    wpm,
    score,
    accuracy,
    wave = 1,
    wordsCompleted = 0,
    durationSeconds = 0,
    weekId: explicitWeekId,
    dayId: explicitDayId,
  } = runData || {};

  // Support runId, gameSessionId, or sessionId
  const effectiveSessionId = (gameSessionId || runId || sessionId || '').trim();
  const safePlayerId = (playerId || player_id || '').trim();
  const rawPlayerName = (playerName || player_name || name || '').trim();

  if (!effectiveSessionId || effectiveSessionId.length > 128) {
    throw new Error('Invalid game session ID');
  }
  if (!safePlayerId || safePlayerId.length > 128) {
    throw new Error('Invalid player ID');
  }
  if (rawPlayerName.length < 2 || rawPlayerName.length > 25) {
    throw new Error('Invalid player name (must be 2–25 characters)');
  }
  const safePlayerName = sanitizePlayerName(rawPlayerName);
  if (safePlayerName.length < 2 || safePlayerName.length > 25) {
    throw new Error('Invalid player name (must be 2–25 characters)');
  }

  const numWpm = Math.max(0, Math.min(400, Math.round(Number(wpm) || 0)));
  const numScore = Math.max(0, Math.round(Number(score) || 0));
  const numAccuracy = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 0)));
  const numWave = Math.max(1, Math.round(Number(wave) || 1));
  const numWords = Math.max(0, Math.round(Number(wordsCompleted) || 0));
  const numDuration = Math.max(0, Math.round(Number(durationSeconds) || 0));

  const serverTime = Date.now();
  const currentWeekId = explicitWeekId || getWeekId(serverTime);
  const currentDayId = explicitDayId || getDayId(serverTime);
  const entryId = effectiveSessionId || generateUuid();

  const sql = getSqlClient();

  if (sql) {
    await ensureCloudSchema(sql);

    // 1. Check duplicate session ID
    const existingSession = await sql`
      SELECT session_id, created_at FROM game_sessions WHERE session_id = ${effectiveSessionId} LIMIT 1;
    `;
    if (existingSession.length > 0) {
      return {
        success: true,
        alreadyRecorded: true,
        sessionId: effectiveSessionId,
        runId: effectiveSessionId,
        completedAt: Number(existingSession[0].created_at),
      };
    }

    // 2. Insert into game_sessions to guard against concurrent duplicates
    await sql`
      INSERT INTO game_sessions (session_id, player_id, score, created_at)
      VALUES (${effectiveSessionId}, ${safePlayerId}, ${numScore}, ${serverTime})
      ON CONFLICT (session_id) DO NOTHING;
    `;

    // 3. Ensure player profile
    await upsertPlayer(safePlayerId, safePlayerName);

    // Step 9: Migrate old broken records for this player safely without overwriting other participants
    await sql`
      UPDATE leaderboard
      SET player_name = ${safePlayerName}
      WHERE player_id = ${safePlayerId} AND (player_name IS NULL OR player_name = '' OR player_name = 'Unnamed Player');
    `;

    // 4. Safe UPSERT on leaderboard table
    const id = entryId;
    const rows = await sql`
      INSERT INTO leaderboard (
        id, player_id, player_name, total_points, weekly_points, daily_points,
        best_wpm, best_accuracy, games_played, last_score,
        created_at, updated_at, last_played_at, week_id, day_id
      ) VALUES (
        ${id}, ${safePlayerId}, ${safePlayerName}, ${numScore}, ${numScore}, ${numScore},
        ${numWpm}, ${numAccuracy}, 1, ${numScore},
        ${serverTime}, ${serverTime}, ${serverTime}, ${currentWeekId}, ${currentDayId}
      )
      ON CONFLICT (player_id, week_id) DO UPDATE SET
        weekly_points = leaderboard.weekly_points + ${numScore},
        total_points = leaderboard.total_points + ${numScore},
        daily_points = CASE
          WHEN leaderboard.day_id = ${currentDayId} THEN leaderboard.daily_points + ${numScore}
          ELSE ${numScore}
        END,
        best_wpm = GREATEST(leaderboard.best_wpm, ${numWpm}),
        best_accuracy = GREATEST(leaderboard.best_accuracy, ${numAccuracy}),
        games_played = leaderboard.games_played + 1,
        last_score = ${numScore},
        player_name = ${safePlayerName},
        day_id = ${currentDayId},
        updated_at = ${serverTime},
        last_played_at = ${serverTime}
      RETURNING *;
    `;

    const updatedRow = rows[0];
    return {
      success: true,
      alreadyRecorded: false,
      sessionId: effectiveSessionId,
      runId: effectiveSessionId,
      completedAt: serverTime,
      record: {
        id: updatedRow.id,
        playerId: updatedRow.player_id,
        player_id: updatedRow.player_id,
        playerName: updatedRow.player_name,
        player_name: updatedRow.player_name,
        name: updatedRow.player_name,
        weeklyPoints: Number(updatedRow.weekly_points),
        totalPoints: Number(updatedRow.total_points),
        dailyPoints: Number(updatedRow.daily_points),
        bestWpm: Number(updatedRow.best_wpm),
        bestAccuracy: Number(updatedRow.best_accuracy),
        gamesPlayed: Number(updatedRow.games_played),
        lastScore: Number(updatedRow.last_score),
        lastPlayedAt: Number(updatedRow.last_played_at),
        weekId: updatedRow.week_id,
        dayId: updatedRow.day_id,
      },
    };
  }

  // --- In-Memory Emulation ---
  if (memorySessions.has(effectiveSessionId)) {
    const existing = memorySessions.get(effectiveSessionId);
    return {
      success: true,
      alreadyRecorded: true,
      sessionId: effectiveSessionId,
      runId: effectiveSessionId,
      completedAt: existing.createdAt,
    };
  }

  // Guard session
  memorySessions.set(effectiveSessionId, {
    sessionId: effectiveSessionId,
    playerId: safePlayerId,
    score: numScore,
    createdAt: serverTime,
  });

  await upsertPlayer(safePlayerId, safePlayerName);

  // Step 9: In-memory safe repair of old records for this specific player
  for (const [k, r] of memoryLeaderboard.entries()) {
    if (r.player_id === safePlayerId && (!r.player_name || r.player_name === 'Unnamed Player')) {
      r.player_name = safePlayerName;
      r.playerName = safePlayerName;
      r.name = safePlayerName;
      memoryLeaderboard.set(k, r);
    }
  }

  const memKey = `${safePlayerId}_${currentWeekId}`;
  const existingRecord = memoryLeaderboard.get(memKey);

  const prevLifetime = memoryLifetimePoints.get(safePlayerId) || 0;
  const newLifetime = prevLifetime + numScore;
  memoryLifetimePoints.set(safePlayerId, newLifetime);

  let record;
  if (existingRecord) {
    const isSameDay = existingRecord.day_id === currentDayId;
    record = {
      ...existingRecord,
      player_name: safePlayerName,
      playerName: safePlayerName,
      name: safePlayerName,
      weekly_points: existingRecord.weekly_points + numScore,
      total_points: newLifetime,
      daily_points: isSameDay ? existingRecord.daily_points + numScore : numScore,
      best_wpm: Math.max(existingRecord.best_wpm, numWpm),
      best_accuracy: Math.max(existingRecord.best_accuracy, numAccuracy),
      games_played: existingRecord.games_played + 1,
      last_score: numScore,
      day_id: currentDayId,
      updated_at: serverTime,
      last_played_at: serverTime,
    };
  } else {
    record = {
      id: entryId,
      player_id: safePlayerId,
      playerId: safePlayerId,
      player_name: safePlayerName,
      playerName: safePlayerName,
      name: safePlayerName,
      weekly_points: numScore,
      total_points: newLifetime,
      daily_points: numScore,
      best_wpm: numWpm,
      best_accuracy: numAccuracy,
      games_played: 1,
      last_score: numScore,
      week_id: currentWeekId,
      day_id: currentDayId,
      created_at: serverTime,
      updated_at: serverTime,
      last_played_at: serverTime,
    };
  }

  memoryLeaderboard.set(memKey, record);

  return {
    success: true,
    alreadyRecorded: false,
    sessionId: effectiveSessionId,
    runId: effectiveSessionId,
    completedAt: serverTime,
    record: {
      id: record.id,
      playerId: record.player_id,
      player_id: record.player_id,
      playerName: record.player_name,
      player_name: record.player_name,
      name: record.player_name,
      weeklyPoints: record.weekly_points,
      totalPoints: record.total_points,
      dailyPoints: record.daily_points,
      bestWpm: record.best_wpm,
      bestAccuracy: record.best_accuracy,
      gamesPlayed: record.games_played,
      lastScore: record.last_score,
      lastPlayedAt: record.last_played_at,
      weekId: record.week_id,
      dayId: record.day_id,
    },
  };
}

/**
 * Fetch the weekly leaderboard ranked by:
 * 1. Weekly Total Points DESC
 * 2. Best WPM DESC
 * 3. Best Accuracy DESC
 * 4. Earlier achieved first (last_played_at ASC)
 */
export async function getWeeklyLeaderboard(targetPlayerId = null, weekIdOverride = null) {
  const now = Date.now();
  const currentWeekId = weekIdOverride || getWeekId(now);
  const sql = getSqlClient();

  if (sql) {
    await ensureCloudSchema(sql);

    const rows = await sql`
      SELECT
        id,
        player_id,
        player_name,
        total_points,
        weekly_points,
        daily_points,
        best_wpm,
        best_accuracy,
        games_played,
        last_score,
        last_played_at,
        week_id,
        day_id,
        ROW_NUMBER() OVER (
          ORDER BY weekly_points DESC, best_wpm DESC, best_accuracy DESC, last_played_at ASC
        ) as rank
      FROM leaderboard
      WHERE week_id = ${currentWeekId}
      ORDER BY rank ASC;
    `;

    let targetPlayerRank = null;
    const formattedEntries = rows.map((row) => {
      const entry = {
        rank: Number(row.rank),
        id: row.id,
        runId: row.id, // compatibility
        playerId: row.player_id,
        player_id: row.player_id,
        playerName: row.player_name || 'Unnamed Player',
        player_name: row.player_name || 'Unnamed Player',
        name: row.player_name || 'Unnamed Player',
        weeklyPoints: Number(row.weekly_points),
        points: Number(row.weekly_points),
        score: Number(row.weekly_points), // compatibility
        totalPoints: Number(row.total_points),
        dailyPoints: Number(row.daily_points),
        bestWpm: Number(row.best_wpm),
        wpm: Number(row.best_wpm), // compatibility
        bestAccuracy: Number(row.best_accuracy),
        accuracy: Number(row.best_accuracy), // compatibility
        gamesPlayed: Number(row.games_played),
        lastScore: Number(row.last_score),
        lastPlayedAt: Number(row.last_played_at),
        completedAt: Number(row.last_played_at), // compatibility
        weekId: row.week_id,
        dayId: row.day_id,
      };

      if (targetPlayerId && row.player_id === targetPlayerId) {
        targetPlayerRank = entry;
      }
      return entry;
    });

    return {
      entries: formattedEntries,
      totalEligible: formattedEntries.length,
      serverTime: now,
      weekId: currentWeekId,
      playerRank: targetPlayerRank,
    };
  }

  // In-memory fallback
  const eligibleRecords = Array.from(memoryLeaderboard.values()).filter(
    (r) => r.week_id === currentWeekId
  );

  eligibleRecords.sort((a, b) => compareLeaderboardEntries(a, b, 'weekly_points'));

  let targetPlayerRank = null;
  const formattedEntries = eligibleRecords.map((r, index) => {
    const entry = {
      rank: index + 1,
      id: r.id,
      runId: r.id,
      playerId: r.player_id,
      player_id: r.player_id,
      playerName: r.player_name || 'Unnamed Player',
      player_name: r.player_name || 'Unnamed Player',
      name: r.player_name || 'Unnamed Player',
      weeklyPoints: r.weekly_points,
      points: r.weekly_points,
      score: r.weekly_points,
      totalPoints: r.total_points,
      dailyPoints: r.daily_points,
      bestWpm: r.best_wpm,
      wpm: r.best_wpm,
      bestAccuracy: r.best_accuracy,
      accuracy: r.best_accuracy,
      gamesPlayed: r.games_played,
      lastScore: r.last_score,
      lastPlayedAt: r.last_played_at,
      completedAt: r.last_played_at,
      weekId: r.week_id,
      dayId: r.day_id,
    };

    if (targetPlayerId && r.player_id === targetPlayerId) {
      targetPlayerRank = entry;
    }
    return entry;
  });

  return {
    entries: formattedEntries,
    totalEligible: formattedEntries.length,
    serverTime: now,
    weekId: currentWeekId,
    playerRank: targetPlayerRank,
  };
}

/**
 * Fetch daily leaderboard participants for current calendar day in Asia/Kolkata.
 */
export async function getDailyLeaderboard(targetPlayerId = null, dayIdOverride = null) {
  const now = Date.now();
  const currentDayId = dayIdOverride || getDayId(now);
  const sql = getSqlClient();

  if (sql) {
    await ensureCloudSchema(sql);

    const rows = await sql`
      SELECT
        id,
        player_id,
        player_name,
        total_points,
        weekly_points,
        daily_points,
        best_wpm,
        best_accuracy,
        games_played,
        last_score,
        last_played_at,
        week_id,
        day_id,
        ROW_NUMBER() OVER (
          ORDER BY daily_points DESC, best_wpm DESC, best_accuracy DESC, last_played_at ASC
        ) as rank
      FROM leaderboard
      WHERE day_id = ${currentDayId} AND daily_points > 0
      ORDER BY rank ASC;
    `;

    let targetPlayerRank = null;
    const formattedEntries = rows.map((row) => {
      const entry = {
        rank: Number(row.rank),
        id: row.id,
        runId: row.id,
        playerId: row.player_id,
        player_id: row.player_id,
        playerName: row.player_name || 'Unnamed Player',
        player_name: row.player_name || 'Unnamed Player',
        name: row.player_name || 'Unnamed Player',
        points: Number(row.daily_points),
        dailyPoints: Number(row.daily_points),
        weeklyPoints: Number(row.weekly_points),
        totalPoints: Number(row.total_points),
        score: Number(row.daily_points),
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

      if (targetPlayerId && row.player_id === targetPlayerId) {
        targetPlayerRank = entry;
      }
      return entry;
    });

    return {
      entries: formattedEntries,
      totalEligible: formattedEntries.length,
      serverTime: now,
      dayId: currentDayId,
      playerRank: targetPlayerRank,
    };
  }

  // In-memory fallback
  const eligibleRecords = Array.from(memoryLeaderboard.values()).filter(
    (r) => r.day_id === currentDayId && r.daily_points > 0
  );

  eligibleRecords.sort((a, b) => compareLeaderboardEntries(a, b, 'daily_points'));

  let targetPlayerRank = null;
  const formattedEntries = eligibleRecords.map((r, index) => {
    const entry = {
      rank: index + 1,
      id: r.id,
      runId: r.id,
      playerId: r.player_id,
      player_id: r.player_id,
      playerName: r.player_name || 'Unnamed Player',
      player_name: r.player_name || 'Unnamed Player',
      name: r.player_name || 'Unnamed Player',
      points: r.daily_points,
      dailyPoints: r.daily_points,
      weeklyPoints: r.weekly_points,
      totalPoints: r.total_points,
      score: r.daily_points,
      bestWpm: r.best_wpm,
      wpm: r.best_wpm,
      bestAccuracy: r.best_accuracy,
      accuracy: r.best_accuracy,
      gamesPlayed: r.games_played,
      lastScore: r.last_score,
      lastPlayedAt: r.last_played_at,
      completedAt: r.last_played_at,
      weekId: r.week_id,
      dayId: r.day_id,
    };

    if (targetPlayerId && r.player_id === targetPlayerId) {
      targetPlayerRank = entry;
    }
    return entry;
  });

  return {
    entries: formattedEntries,
    totalEligible: formattedEntries.length,
    serverTime: now,
    dayId: currentDayId,
    playerRank: targetPlayerRank,
  };
}
