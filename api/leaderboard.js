import { handleCors, parseQueryParams, sendJsonResponse } from './lib/utils.js';
import { getWeeklyLeaderboard } from './lib/db.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJsonResponse(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const query = parseQueryParams(req);
    const playerId = query.playerId || null;
    const leaderboardData = await getWeeklyLeaderboard(playerId);

    return sendJsonResponse(res, 200, leaderboardData);
  } catch (error) {
    console.error('[API /api/leaderboard Error]:', error);
    return sendJsonResponse(res, 500, {
      error: error.message || 'Failed to fetch weekly leaderboard',
    });
  }
}
