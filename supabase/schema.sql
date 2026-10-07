-- Public reads; only the validated Edge Function writes scores.
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL CHECK (length(trim(player_name)) BETWEEN 2 AND 25),
  total_points BIGINT NOT NULL DEFAULT 0,
  best_wpm NUMERIC NOT NULL DEFAULT 0,
  best_accuracy NUMERIC NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  daily_points BIGINT NOT NULL DEFAULT 0,
  weekly_points BIGINT NOT NULL DEFAULT 0,
  last_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  week_id TEXT NOT NULL,
  day_id TEXT NOT NULL,
  CONSTRAINT uq_player_week UNIQUE (player_id, week_id)
);
CREATE TABLE IF NOT EXISTS public.game_sessions (
  session_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_week_rank
  ON public.leaderboard (week_id, weekly_points DESC, best_wpm DESC, best_accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_day_rank
  ON public.leaderboard (day_id, daily_points DESC, best_wpm DESC, best_accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_player_id ON public.leaderboard (player_id);
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leaderboard, public.game_sessions FROM anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT ALL ON public.leaderboard, public.game_sessions TO service_role;
DROP POLICY IF EXISTS "Allow public select on leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public select on leaderboard" ON public.leaderboard
  FOR SELECT TO anon, authenticated USING (true);
-- Never grant direct score mutations to browser clients.
DROP POLICY IF EXISTS "Allow public insert on leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow public update on leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Allow public select on game_sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow public insert on game_sessions" ON public.game_sessions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leaderboard') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.submit_game_score(
  p_session_id TEXT, p_player_id TEXT, p_player_name TEXT,
  p_score INTEGER, p_wpm NUMERIC, p_accuracy NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_record public.leaderboard;
  v_existing public.game_sessions;
  v_ist DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_sunday DATE;
  v_week TEXT;
  v_day TEXT;
  v_total BIGINT;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) NOT BETWEEN 1 AND 128
    OR p_player_id IS NULL OR length(trim(p_player_id)) NOT BETWEEN 1 AND 128
    OR p_player_name IS NULL OR length(trim(p_player_name)) NOT BETWEEN 2 AND 25
    OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 10000000
    OR p_wpm IS NULL OR p_wpm NOT BETWEEN 0 AND 400
    OR p_accuracy IS NULL OR p_accuracy NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Invalid score submission' USING ERRCODE = '22023';
  END IF;
  -- Entire session + score save is transactional; retries cannot add twice.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_player_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id, 1));
  SELECT * INTO v_existing FROM public.game_sessions WHERE session_id = p_session_id;
  IF FOUND THEN
    IF v_existing.player_id <> p_player_id THEN
      RAISE EXCEPTION 'Session belongs to another player' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('success', true, 'alreadyRecorded', true,
      'sessionId', p_session_id, 'completedAt', extract(epoch FROM v_existing.created_at) * 1000);
  END IF;
  -- Dates come from the server, not the browser clock.
  v_sunday := v_ist - extract(dow FROM v_ist)::integer;
  v_week := extract(year FROM v_sunday)::text || '-W' ||
    lpad((floor((extract(doy FROM v_sunday) - 1) / 7) + 1)::integer::text, 2, '0');
  v_day := to_char(v_ist, 'YYYY-MM-DD');
  SELECT coalesce(sum(weekly_points), 0) + p_score INTO v_total
    FROM public.leaderboard WHERE player_id = p_player_id;
  INSERT INTO public.game_sessions(session_id, player_id, score)
    VALUES (p_session_id, p_player_id, p_score);
  INSERT INTO public.leaderboard AS lb (
    player_id, player_name, total_points, weekly_points, daily_points,
    best_wpm, best_accuracy, games_played, last_score, week_id, day_id
  ) VALUES (
    p_player_id, trim(p_player_name), v_total, p_score, p_score,
    p_wpm, p_accuracy, 1, p_score, v_week, v_day
  ) ON CONFLICT (player_id, week_id) DO UPDATE SET
    player_name = EXCLUDED.player_name,
    total_points = v_total,
    weekly_points = lb.weekly_points + p_score,
    daily_points = CASE WHEN lb.day_id = v_day THEN lb.daily_points + p_score ELSE p_score END,
    best_wpm = greatest(lb.best_wpm, p_wpm),
    best_accuracy = greatest(lb.best_accuracy, p_accuracy),
    games_played = lb.games_played + 1,
    last_score = p_score,
    day_id = v_day,
    updated_at = now(),
    last_played_at = now()
  RETURNING * INTO v_record;
  RETURN jsonb_build_object('success', true, 'alreadyRecorded', false,
    'sessionId', p_session_id, 'completedAt', extract(epoch FROM now()) * 1000,
    'record', to_jsonb(v_record));
END;
$$;
REVOKE ALL ON FUNCTION public.submit_game_score(TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_game_score(TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC)
  TO service_role;
