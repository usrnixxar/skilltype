-- ==============================================================================
-- SkillType Leaderboard Database Schema for Supabase / PostgreSQL
-- ==============================================================================

-- 1. Main Leaderboard Table (1 entry per player per competition week)
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  best_wpm NUMERIC NOT NULL DEFAULT 0,
  best_accuracy NUMERIC NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  daily_points INTEGER NOT NULL DEFAULT 0,
  weekly_points INTEGER NOT NULL DEFAULT 0,
  last_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  week_id TEXT NOT NULL,
  day_id TEXT NOT NULL,
  CONSTRAINT uq_player_week UNIQUE (player_id, week_id)
);

-- 2. Game Sessions Table for Idempotent Duplicate Submission Prevention
CREATE TABLE IF NOT EXISTS public.game_sessions (
  session_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_week_rank 
  ON public.leaderboard (week_id, weekly_points DESC, best_wpm DESC, best_accuracy DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_day_rank 
  ON public.leaderboard (day_id, daily_points DESC, best_wpm DESC, best_accuracy DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_player_id 
  ON public.leaderboard (player_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Leaderboard RLS Policies
-- Allow anyone to read the leaderboard (public leaderboard display)
CREATE POLICY "Allow public select on leaderboard"
  ON public.leaderboard
  FOR SELECT
  USING (true);

-- Allow public insert with strict range checks
CREATE POLICY "Allow public insert on leaderboard"
  ON public.leaderboard
  FOR INSERT
  WITH CHECK (
    length(trim(player_name)) >= 2 AND
    length(player_name) <= 25 AND
    weekly_points >= 0 AND
    total_points >= 0 AND
    daily_points >= 0 AND
    best_wpm >= 0 AND best_wpm <= 400 AND
    best_accuracy >= 0 AND best_accuracy <= 100
  );

-- Allow public update with strict range checks
CREATE POLICY "Allow public update on leaderboard"
  ON public.leaderboard
  FOR UPDATE
  USING (true)
  WITH CHECK (
    weekly_points >= 0 AND
    total_points >= 0 AND
    daily_points >= 0 AND
    best_wpm >= 0 AND best_wpm <= 400 AND
    best_accuracy >= 0 AND best_accuracy <= 100
  );

-- 6. Game Sessions RLS Policies
CREATE POLICY "Allow public select on game_sessions"
  ON public.game_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on game_sessions"
  ON public.game_sessions
  FOR INSERT
  WITH CHECK (true);

-- 7. Realtime Replication for Live Leaderboard Updates across Devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;

-- 8. Safe Atomic Upsert RPC Function
CREATE OR REPLACE FUNCTION public.submit_game_score(
  p_session_id TEXT,
  p_player_id TEXT,
  p_player_name TEXT,
  p_score INTEGER,
  p_wpm NUMERIC,
  p_accuracy NUMERIC,
  p_week_id TEXT,
  p_day_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_recorded BOOLEAN := false;
  v_record RECORD;
BEGIN
  -- 1. Check duplicate session ID
  IF EXISTS (SELECT 1 FROM public.game_sessions WHERE session_id = p_session_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'alreadyRecorded', true,
      'sessionId', p_session_id
    );
  END IF;

  -- 2. Insert into game_sessions to guard against concurrent replay
  INSERT INTO public.game_sessions (session_id, player_id, score, created_at)
  VALUES (p_session_id, p_player_id, p_score, NOW());

  -- 3. Atomic UPSERT on leaderboard
  INSERT INTO public.leaderboard (
    player_id, player_name, total_points, weekly_points, daily_points,
    best_wpm, best_accuracy, games_played, last_score,
    created_at, updated_at, last_played_at, week_id, day_id
  ) VALUES (
    p_player_id, p_player_name, p_score, p_score, p_score,
    p_wpm, p_accuracy, 1, p_score,
    NOW(), NOW(), NOW(), p_week_id, p_day_id
  )
  ON CONFLICT (player_id, week_id) DO UPDATE SET
    weekly_points = public.leaderboard.weekly_points + p_score,
    total_points = public.leaderboard.total_points + p_score,
    daily_points = CASE 
      WHEN public.leaderboard.day_id = p_day_id THEN public.leaderboard.daily_points + p_score
      ELSE p_score 
    END,
    best_wpm = GREATEST(public.leaderboard.best_wpm, p_wpm),
    best_accuracy = GREATEST(public.leaderboard.best_accuracy, p_accuracy),
    games_played = public.leaderboard.games_played + 1,
    last_score = p_score,
    player_name = p_player_name,
    day_id = p_day_id,
    updated_at = NOW(),
    last_played_at = NOW()
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'success', true,
    'alreadyRecorded', false,
    'sessionId', p_session_id,
    'record', to_jsonb(v_record)
  );
END;
$$;
