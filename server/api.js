import { upsertPlayer, recordCompletedRun, getWeeklyLeaderboard, getDailyLeaderboard } from './db.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 500000) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Malformed JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  });
  res.end(json);
}

export async function handleApiRequest(req, res) {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    });
    res.end();
    return true;
  }

  // Parse URL & Query params
  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

  if (!pathname.startsWith('/api')) {
    return false; // Not an API request
  }

  try {
    // 1. Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'SkillType Leaderboard Service',
      });
      return true;
    }

    // 2. Leaderboard (Weekly or Daily)
    if (pathname === '/api/leaderboard' && req.method === 'GET') {
      const playerId = parsedUrl.searchParams.get('playerId');
      const type = parsedUrl.searchParams.get('type') || 'weekly';
      const weekId = parsedUrl.searchParams.get('weekId');
      const dayId = parsedUrl.searchParams.get('dayId');

      let data;
      if (type === 'daily') {
        data = await getDailyLeaderboard(playerId, dayId);
      } else {
        data = await getWeeklyLeaderboard(playerId, weekId);
      }
      sendJson(res, 200, data);
      return true;
    }

    // 3. Register / Update Player
    if (pathname === '/api/players' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const id = body.id || body.playerId || body.player_id;
      const name = body.name || body.playerName || body.player_name;
      const player = await upsertPlayer(id, name);
      sendJson(res, 200, { success: true, player });
      return true;
    }

    // 4. Submit Completed Run
    if (pathname === '/api/runs' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await recordCompletedRun(body);
      sendJson(res, 200, result);
      return true;
    }

    // 404 for unknown /api route
    sendJson(res, 404, { error: 'Endpoint not found' });
    return true;
  } catch (error) {
    console.error('API Error:', error);
    sendJson(res, 400, { error: error.message || 'Internal Server Error' });
    return true;
  }
}
