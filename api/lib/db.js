import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

/**
 * Sanitize and validate player display name (2–24 characters, strip HTML & control chars).
 */
export function sanitizePlayerName(name) {
  if (typeof name !== 'string') return '';
  const cleaned = name
    .replace(/<[^>]*>?/gm, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
  return cleaned.substring(0, 24);
}

/**
 * Compare two runs according to official SkillType ranking rules:
 * 1. Highest WPM first
 * 2. If WPM ties -> highest Score
 * 3. If Score ties -> highest Accuracy
 * 4. If still tied -> earlier completed run first (completedAt ASC)
 */
export function compareRuns(a, b) {
  if (b.wpm !== a.wpm) return b.wpm - a.wpm;
  if (b.score !== a.score) return b.score - a.score;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  return a.completedAt - b.completedAt;
}

// In-memory fallback for local dev / testing when no cloud database connection string is provided
const memoryPlayers = new Map();
const memoryRuns = new Map();

export function resetInMemoryDatabase() {
  memoryPlayers.clear();
  memoryRuns.clear();
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
      await sql`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          last_seen_at BIGINT NOT NULL
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          player_name TEXT NOT NULL,
          wpm INTEGER NOT NULL,
          score INTEGER NOT NULL,
          accuracy INTEGER NOT NULL,
          wave INTEGER NOT NULL,
          words_completed INTEGER NOT NULL,
          duration_seconds INTEGER NOT NULL,
          completed_at BIGINT NOT NULL
        );
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_runs_completed_at ON runs(completed_at);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_runs_player_id ON runs(player_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_runs_ranking ON runs(wpm DESC, score DESC, accuracy DESC, completed_at ASC);`;
    })();
  }
  return schemaInitPromise;
}

/**
 * Register or update player profile in the persistent database.
 */
export async function upsertPlayer(id, name) {
  const safeId = typeof id === 'string' ? id.trim() : '';
  const rawCleaned =
    typeof name === 'string'
      ? name
          .replace(/<[^>]*>?/gm, '')
          .replace(/[\x00-\x1F\x7F]/g, '')
          .trim()
      : '';

  if (!safeId || rawCleaned.length < 2 || rawCleaned.length > 24) {
    throw new Error('Invalid player ID or name (name must be 2–24 characters)');
  }
  const safeName = rawCleaned.substring(0, 24);

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
 * Record a completed game run.
 * Server stamps completedAt for rolling-window integrity.
 * Prevents duplicate run insertion using runId.
 */
export async function recordCompletedRun(runData) {
  const {
    runId,
    playerId,
    playerName,
    wpm,
    score,
    accuracy,
    wave = 1,
    wordsCompleted = 0,
    durationSeconds = 0,
  } = runData || {};

  const safeRunId = typeof runId === 'string' ? runId.trim() : '';
  const safePlayerId = typeof playerId === 'string' ? playerId.trim() : '';
  const safePlayerName = sanitizePlayerName(playerName);

  if (!safeRunId || safeRunId.length > 64) {
    throw new Error('Invalid run ID');
  }
  if (!safePlayerId || safePlayerId.length > 64) {
    throw new Error('Invalid player ID');
  }
  if (safePlayerName.length < 2 || safePlayerName.length > 24) {
    throw new Error('Invalid player name');
  }

  const numWpm = Math.max(0, Math.min(400, Math.round(Number(wpm) || 0)));
  const numScore = Math.max(0, Math.round(Number(score) || 0));
  const numAccuracy = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 0)));
  const numWave = Math.max(1, Math.round(Number(wave) || 1));
  const numWords = Math.max(0, Math.round(Number(wordsCompleted) || 0));
  const numDuration = Math.max(0, Math.round(Number(durationSeconds) || 0));

  const sql = getSqlClient();

  if (sql) {
    await ensureCloudSchema(sql);

    // 1. Check if run was already recorded (idempotent submission)
    const existing = await sql`
      SELECT id, completed_at FROM runs WHERE id = ${safeRunId} LIMIT 1;
    `;
    if (existing.length > 0) {
      return {
        success: true,
        alreadyRecorded: true,
        runId: safeRunId,
        completedAt: Number(existing[0].completed_at),
      };
    }

    // 2. Ensure player profile exists
    await upsertPlayer(safePlayerId, safePlayerName);

    // 3. Server stamps authoritative completedAt timestamp
    const serverCompletedAt = Date.now();

    try {
      await sql`
        INSERT INTO runs (
          id, player_id, player_name, wpm, score, accuracy, wave, words_completed, duration_seconds, completed_at
        ) VALUES (
          ${safeRunId}, ${safePlayerId}, ${safePlayerName}, ${numWpm}, ${numScore},
          ${numAccuracy}, ${numWave}, ${numWords}, ${numDuration}, ${serverCompletedAt}
        );
      `;

      return {
        success: true,
        alreadyRecorded: false,
        runId: safeRunId,
        completedAt: serverCompletedAt,
      };
    } catch (err) {
      // If concurrent request inserted same runId, handle duplicate safely
      if (err.message && err.message.includes('unique')) {
        const found = await sql`
          SELECT id, completed_at FROM runs WHERE id = ${safeRunId} LIMIT 1;
        `;
        return {
          success: true,
          alreadyRecorded: true,
          runId: safeRunId,
          completedAt: found.length > 0 ? Number(found[0].completed_at) : serverCompletedAt,
        };
      }
      throw err;
    }
  }

  // In-memory fallback
  if (memoryRuns.has(safeRunId)) {
    const existing = memoryRuns.get(safeRunId);
    return {
      success: true,
      alreadyRecorded: true,
      runId: safeRunId,
      completedAt: existing.completedAt,
    };
  }

  await upsertPlayer(safePlayerId, safePlayerName);
  const serverCompletedAt = Date.now();
  const runRecord = {
    id: safeRunId,
    playerId: safePlayerId,
    playerName: safePlayerName,
    wpm: numWpm,
    score: numScore,
    accuracy: numAccuracy,
    wave: numWave,
    wordsCompleted: numWords,
    durationSeconds: numDuration,
    completedAt: serverCompletedAt,
  };
  memoryRuns.set(safeRunId, runRecord);

  return {
    success: true,
    alreadyRecorded: false,
    runId: safeRunId,
    completedAt: serverCompletedAt,
  };
}

/**
 * Fetch the rolling 7-day weekly leaderboard from persistent storage.
 * Only runs completed during the last rolling 7 days count.
 * Only one best run per player appears.
 * Ranked by: WPM DESC, Score DESC, Accuracy DESC, completedAt ASC.
 */
export async function getWeeklyLeaderboard(targetPlayerId = null) {
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = now - SEVEN_DAYS_MS;

  const sql = getSqlClient();

  if (sql) {
    await ensureCloudSchema(sql);

    const rows = await sql`
      WITH eligible_runs AS (
        SELECT
          id,
          player_id,
          player_name,
          wpm,
          score,
          accuracy,
          wave,
          words_completed,
          duration_seconds,
          completed_at,
          ROW_NUMBER() OVER (
            PARTITION BY player_id
            ORDER BY wpm DESC, score DESC, accuracy DESC, completed_at ASC
          ) as player_run_rank
        FROM runs
        WHERE completed_at >= ${cutoff}
      ),
      best_runs AS (
        SELECT
          id,
          player_id,
          player_name,
          wpm,
          score,
          accuracy,
          wave,
          words_completed,
          duration_seconds,
          completed_at,
          ROW_NUMBER() OVER (
            ORDER BY wpm DESC, score DESC, accuracy DESC, completed_at ASC
          ) as rank
        FROM eligible_runs
        WHERE player_run_rank = 1
      )
      SELECT * FROM best_runs ORDER BY rank ASC;
    `;

    let targetPlayerRank = null;
    const formattedEntries = rows.map((row) => {
      const entry = {
        rank: Number(row.rank),
        runId: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        wpm: Number(row.wpm),
        score: Number(row.score),
        accuracy: Number(row.accuracy),
        wave: Number(row.wave),
        wordsCompleted: Number(row.words_completed),
        durationSeconds: Number(row.duration_seconds),
        completedAt: Number(row.completed_at),
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
      playerRank: targetPlayerRank,
    };
  }

  // In-memory fallback
  // 1. Filter runs in rolling 7-day window
  const eligibleRuns = Array.from(memoryRuns.values()).filter(
    (r) => r.completedAt >= cutoff
  );

  // 2. Pick only best run per player
  const playerBestMap = new Map();
  for (const run of eligibleRuns) {
    const existing = playerBestMap.get(run.playerId);
    if (!existing || compareRuns(run, existing) < 0) {
      playerBestMap.set(run.playerId, run);
    }
  }

  // 3. Sort overall best runs
  const sortedBestRuns = Array.from(playerBestMap.values()).sort(compareRuns);

  // 4. Format into entries with rank
  let targetPlayerRank = null;
  const formattedEntries = sortedBestRuns.map((r, index) => {
    const entry = {
      rank: index + 1,
      runId: r.id,
      playerId: r.playerId,
      playerName: r.playerName,
      wpm: r.wpm,
      score: r.score,
      accuracy: r.accuracy,
      wave: r.wave,
      wordsCompleted: r.wordsCompleted,
      durationSeconds: r.durationSeconds,
      completedAt: r.completedAt,
    };

    if (targetPlayerId && r.playerId === targetPlayerId) {
      targetPlayerRank = entry;
    }

    return entry;
  });

  return {
    entries: formattedEntries,
    totalEligible: formattedEntries.length,
    serverTime: now,
    playerRank: targetPlayerRank,
  };
}
