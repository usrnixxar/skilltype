import { handleCors, parseJsonBody, sendJsonResponse } from './lib/utils.js';
import { upsertPlayer } from './lib/db.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const id = body.id || body.playerId || body.player_id;
    const name = body.name || body.playerName || body.player_name;

    const player = await upsertPlayer(id, name);
    return sendJsonResponse(res, 200, {
      success: true,
      player,
    });
  } catch (error) {
    console.error('[API /api/players Error]:', error);
    return sendJsonResponse(res, 400, {
      error: error.message || 'Failed to register or update player profile',
    });
  }
}
