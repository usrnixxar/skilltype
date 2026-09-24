import { upsertPlayer, recordCompletedRun, getWeeklyLeaderboard } from './db.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 500000) {
        // 500KB cap
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
      } catch (err) {
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
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

export async function handleApiRequest(req, res) {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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
        serverTime: Date.now(),
      });
      return true;
    }

    // 2. Weekly Leaderboard
    if (pathname === '/api/leaderboard' && req.method === 'GET') {
      const playerId = parsedUrl.searchParams.get('playerId');
      const data = getWeeklyLeaderboard(playerId);
      sendJson(res, 200, data);
      return true;
    }

    // 3. Register / Update Player
    if (pathname === '/api/players' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const player = upsertPlayer(body.id, body.name);
      sendJson(res, 200, { success: true, player });
      return true;
    }

    // 4. Submit Completed Run
    if (pathname === '/api/runs' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = recordCompletedRun(body);
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
