import { handleCors, parseJsonBody, sendJsonResponse } from './lib/utils.js';
import { recordCompletedRun } from './lib/db.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const result = await recordCompletedRun(body);

    return sendJsonResponse(res, 200, result);
  } catch (error) {
    console.error('[API /api/runs Error]:', error);
    return sendJsonResponse(res, error.statusCode || 400, {
      error: error.message || 'Failed to record completed game run',
    });
  }
}
