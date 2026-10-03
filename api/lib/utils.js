/**
 * Shared HTTP helpers for Vercel serverless functions and local dev server.
 */

export function setCorsHeaders(res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  }
}

export function handleCors(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(204).end();
    } else {
      res.writeHead(204);
      res.end();
    }
    return true;
  }
  return false;
}

export async function parseJsonBody(req) {
  // If already parsed by Vercel serverless layer
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Malformed JSON payload');
    }
  }

  // Stream reader for standard Node IncomingMessage
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 500000) {
        req.destroy();
        reject(new Error('Payload too large (max 500KB)'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Malformed JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

export function parseQueryParams(req) {
  if (req.query && typeof req.query === 'object') {
    return req.query;
  }
  const host = req.headers?.host || 'localhost';
  const parsed = new URL(req.url, `http://${host}`);
  return Object.fromEntries(parsed.searchParams.entries());
}

export function sendJsonResponse(res, statusCode, data) {
  setCorsHeaders(res);
  res.setHeader('Cache-Control', 'no-store');

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(statusCode).json(data);
  }

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
