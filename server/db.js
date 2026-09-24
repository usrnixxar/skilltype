import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the data directory exists
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.resolve(DATA_DIR, 'leaderboard.db');

let db = null;

export function getDatabase() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);

  // Enable WAL mode for high concurrency and performance
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

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
      completed_at INTEGER NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_runs_completed_at ON runs(completed_at);
    CREATE INDEX IF NOT EXISTS idx_runs_player_id ON runs(player_id);
    CREATE INDEX IF NOT EXISTS idx_runs_ranking ON runs(wpm DESC, score DESC, accuracy DESC, completed_at ASC);
  `);

  return db;
}

/**
 * Clean & validate player display name (2-24 chars, safe string)
 */
export function sanitizePlayerName(name) {
  if (typeof name !== 'string') return '';
  // Strip control characters and HTML tags
  const cleaned = name.replace(/<[^>]*>?/gm, '').replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned.substring(0, 24);
}

/**
 * Register or update guest player profile
 */
export function upsertPlayer(id, name) {
  const safeId = typeof id === 'string' ? id.trim() : '';
  const safeName = sanitizePlayerName(name);

  if (!safeId || safeName.length < 2 || safeName.length > 24) {
    throw new Error('Invalid player ID or name (name must be 2-24 characters)');
  }

  const database = getDatabase();
  const now = Date.now();

  const existing = database.prepare('SELECT id, name, created_at FROM players WHERE id = ?').get(safeId);

  if (existing) {
    database.prepare('UPDATE players SET name = ?, last_seen_at = ? WHERE id = ?').run(safeName, now, safeId);
    return {
      id: safeId,
      name: safeName,
      createdAt: existing.created_at,
      lastSeenAt: now
    };
  } else {
    database.prepare('INSERT INTO players (id, name, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(
      safeId,
      safeName,
      now,
      now
    );
    return {
      id: safeId,
      name: safeName,
      createdAt: now,
      lastSeenAt: now
    };
  }
}

/**
 * Record a completed game run.
 * Server stamps `completed_at` to enforce server-authoritative 7-day rolling window.
 * Returns { success, runId, completedAt }
 */
export function recordCompletedRun(runData) {
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
  } = runData;

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

  const database = getDatabase();

  // Ensure player exists in players table
  upsertPlayer(safePlayerId, safePlayerName);

  // Check if run already recorded (idempotency, prevents duplicates)
  const existingRun = database.prepare('SELECT id, completed_at FROM runs WHERE id = ?').get(safeRunId);
  if (existingRun) {
    return {
      success: true,
      alreadyRecorded: true,
      runId: safeRunId,
      completedAt: existingRun.completed_at,
    };
  }

  const serverCompletedAt = Date.now();

  const insertStmt = database.prepare(`
    INSERT INTO runs (
      id, player_id, player_name, wpm, score, accuracy, wave, words_completed, duration_seconds, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    safeRunId,
    safePlayerId,
    safePlayerName,
    numWpm,
    numScore,
    numAccuracy,
    numWave,
    numWords,
    numDuration,
    serverCompletedAt
  );

  return {
    success: true,
    alreadyRecorded: false,
    runId: safeRunId,
    completedAt: serverCompletedAt,
  };
}

/**
 * Get the weekly leaderboard (rolling 7 days: completed_at >= now - 7 days).
 * Returns:
 * - entries: Array of best eligible runs per player, sorted by WPM DESC, Score DESC, Accuracy DESC, completed_at ASC
 * - totalEligible: Total number of eligible players in this period
 * - serverTime: Current server timestamp
 * - playerRank: If targetPlayerId is supplied, their row and overall rank (or null if awaiting first result)
 */
export function getWeeklyLeaderboard(targetPlayerId = null) {
  const database = getDatabase();
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = now - SEVEN_DAYS_MS;

  const query = `
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
      WHERE completed_at >= ?
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

  const rows = database.prepare(query).all(cutoff);

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
