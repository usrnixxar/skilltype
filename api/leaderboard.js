import { handleCors, parseQueryParams, sendJsonResponse } from './lib/utils.js';
import { getWeeklyLeaderboard, getDailyLeaderboard } from './lib/db.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJsonResponse(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const query = parseQueryParams(req);
    const playerId = query.playerId || null;
    const type = query.type || 'weekly';
    const weekId = query.weekId || null;
    const dayId = query.dayId || null;

    let leaderboardData;
    if (type === 'daily') {
      leaderboardData = await getDailyLeaderboard(playerId, dayId);
    } else {
      leaderboardData = await getWeeklyLeaderboard(playerId, weekId);
    }

    return sendJsonResponse(res, 200, leaderboardData);
  } catch (error) {
    console.error('[API /api/leaderboard Error]:', error);
    return sendJsonResponse(res, 500, {
      error: error.message || 'Failed to fetch leaderboard data',
    });
  }
}
