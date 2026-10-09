-- Existing sessions start as unknown/offline until their next validated heartbeat.
ALTER TABLE public.player_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.player_sessions ALTER COLUMN last_seen_at SET DEFAULT now();

-- Only the service-role Edge Function can call this RPC. The caller's token is
-- checked against the real admin profile; a client-supplied player ID is never trusted.
CREATE OR REPLACE FUNCTION public.get_admin_player_presence(p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_player_id uuid;
BEGIN
  SELECT player_id INTO v_player_id FROM public.player_sessions
  WHERE token_hash = p_hash AND expires_at > statement_timestamp();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Please log in again' USING ERRCODE = '28000';
  END IF;
  IF v_player_id <> '5c99b1c8-e130-4c27-a750-88e35362c581'::uuid THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'onlinePlayerIds', (SELECT coalesce(jsonb_agg(DISTINCT player_id), '[]'::jsonb)
      FROM public.player_sessions
      WHERE expires_at > statement_timestamp()
        AND last_seen_at > statement_timestamp() - interval '90 seconds'),
    'serverTime', extract(epoch FROM statement_timestamp()) * 1000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_player_presence(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_player_presence(text) TO service_role;
