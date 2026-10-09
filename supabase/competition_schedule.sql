-- Sunday is practice-only in India; week records remain available for the winner.
CREATE OR REPLACE FUNCTION public.is_competition_practice_time(p_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT extract(dow FROM p_at AT TIME ZONE 'Asia/Kolkata') = 0 $$;

CREATE OR REPLACE FUNCTION public.submit_game_score(
  p_session_id TEXT, p_player_id TEXT, p_player_name TEXT,
  p_score INTEGER, p_wpm NUMERIC, p_accuracy NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_record public.leaderboard;
  v_existing public.game_sessions;
  v_ist DATE := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date;
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
  -- Keep a zero-point receipt so this Sunday run cannot be retried for points Monday.
  IF public.is_competition_practice_time(clock_timestamp()) THEN
    INSERT INTO public.game_sessions(session_id, player_id, score)
      VALUES (p_session_id, p_player_id, 0);
    RETURN jsonb_build_object('success', true, 'practiceOnly', true,
      'alreadyRecorded', false, 'sessionId', p_session_id,
      'completedAt', extract(epoch FROM clock_timestamp()) * 1000);
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

CREATE OR REPLACE FUNCTION public.get_competition_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH calendar AS (
    SELECT (statement_timestamp() AT TIME ZONE 'Asia/Kolkata')::date AS today
  ), period AS (
    SELECT today - extract(dow FROM today)::integer - 7 AS previous_sunday FROM calendar
  ), previous_week AS (
    SELECT extract(year FROM previous_sunday)::text || '-W' ||
      lpad((floor((extract(doy FROM previous_sunday)-1)/7)+1)::integer::text, 2, '0') AS week_id
    FROM period
  ), winner AS (
    SELECT l.player_id, l.player_name, l.weekly_points, l.week_id
    FROM public.leaderboard l JOIN previous_week w ON w.week_id = l.week_id
    WHERE l.player_id <> '5c99b1c8-e130-4c27-a750-88e35362c581' AND l.weekly_points > 0
    ORDER BY l.weekly_points DESC, l.best_wpm DESC, l.best_accuracy DESC, l.last_played_at ASC, l.player_id ASC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'serverTime', extract(epoch FROM statement_timestamp()) * 1000,
    'practiceOnly', public.is_competition_practice_time(statement_timestamp()),
    'lastWeekWinner', (SELECT jsonb_build_object('playerId', player_id, 'name', player_name,
      'points', weekly_points, 'weekId', week_id) FROM winner)
  );
$$;
REVOKE ALL ON FUNCTION public.get_competition_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_competition_status() TO anon, authenticated, service_role;
