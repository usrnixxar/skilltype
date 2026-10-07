import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

// Guest game: the Edge gateway verifies the project's anon JWT.
// The service credential stays inside Supabase; browser table writes are denied.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 8192) return reply({ error: 'Score payload too large' }, 413);
    const body = JSON.parse(raw);
    const sessionId = body.gameSessionId || body.runId;
    if (typeof sessionId !== 'string' || !/^[\w-]{1,128}$/.test(sessionId) ||
        typeof body.sessionToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.sessionToken) ||
        !Number.isInteger(body.score) || body.score < 0 || body.score > 10000000 ||
        !Number.isFinite(body.wpm) || body.wpm < 0 || body.wpm > 400 ||
        !Number.isFinite(body.accuracy) || body.accuracy < 0 || body.accuracy > 100) {
      return reply({ error: 'Invalid player name or score' }, 400);
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc('submit_session_score', {
      p_session_id: sessionId, p_hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.sessionToken))), b => b.toString(16).padStart(2, '0')).join(''),
      p_score: body.score, p_wpm: body.wpm, p_accuracy: body.accuracy,
    });
    if (error) {
      console.error('Score transaction failed', error.code);
      return reply({ error: error.code === '28000' ? 'Session expired. Log out and log in again.' : 'Score could not be saved. Please retry.' }, error.code === '28000' ? 401 : error.code === '22023' ? 400 : 503);
    }
    return reply(data);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return reply({ error: 'Invalid score payload' }, 400);
    return reply({ error: 'Score service unavailable. Please retry.' }, 503);
  }
});
