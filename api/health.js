import { handleCors, sendJsonResponse } from './lib/utils.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJsonResponse(res, 405, { error: 'Method Not Allowed' });
  }

  return sendJsonResponse(res, 200, {
    status: 'ok',
    service: 'SkillType Leaderboard Service',
  });
}
