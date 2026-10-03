/**
 * Database interface for SkillType leaderboard.
 * Delegates to cloud-ready persistent storage in api/lib/db.js.
 */

export {
  sanitizePlayerName,
  generateUuid,
  upsertPlayer,
  recordCompletedRun,
  getWeeklyLeaderboard,
  getDailyLeaderboard,
  compareLeaderboardEntries,
  compareRuns,
  isCloudDatabaseConfigured,
  resetInMemoryDatabase,
} from '../api/lib/db.js';
