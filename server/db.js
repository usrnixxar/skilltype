/**
 * Database interface for SkillType leaderboard.
 * Delegates to cloud-ready persistent storage in api/lib/db.js (Neon PostgreSQL with fallback).
 * Removes runtime dependency on node:sqlite and local data/leaderboard.db filesystem storage.
 */

export {
  sanitizePlayerName,
  upsertPlayer,
  recordCompletedRun,
  getWeeklyLeaderboard,
  compareRuns,
  isCloudDatabaseConfigured,
  resetInMemoryDatabase,
} from '../api/lib/db.js';
