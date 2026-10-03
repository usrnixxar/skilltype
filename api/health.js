import { handleCors, sendJsonResponse } from './lib/utils.js';
import { isCloudDatabaseConfigured } from './lib/db.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJsonResponse(res, 405, { error: 'Method Not Allowed' });
  }

  const persistentStorageConfigured = isCloudDatabaseConfigured();
  return sendJsonResponse(res, persistentStorageConfigured ? 200 : 503, {
    status: persistentStorageConfigured ? 'configured' : 'unconfigured',
    service: 'SkillType Leaderboard Service',
    persistentStorageConfigured,
    // Configuration presence is not a database connectivity check.
  });
}
