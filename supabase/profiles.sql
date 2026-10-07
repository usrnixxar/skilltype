-- Apply after schema.sql. Enrollment PINs are intentionally public on rankings.
CREATE TABLE public.student_codes (
  pin text PRIMARY KEY CHECK (pin ~ '^[0-9]{6}$'),
  enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE public.player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 25),
  kind text NOT NULL CHECK (kind IN ('student','guest')),
  pin text UNIQUE REFERENCES public.student_codes(pin),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'student' AND pin IS NOT NULL) OR (kind = 'guest' AND pin IS NULL))
);
CREATE TABLE public.player_sessions (
  token_hash text PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.player_profiles(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
ALTER TABLE public.student_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_codes, public.player_profiles, public.player_sessions FROM anon, authenticated;
GRANT ALL ON public.student_codes, public.player_profiles, public.player_sessions TO service_role;
ALTER TABLE public.leaderboard ADD COLUMN player_type text NOT NULL DEFAULT 'guest', ADD COLUMN student_pin text;

CREATE FUNCTION public.mask_player_name(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT string_agg(CASE WHEN length(w) <= 2 THEN left(w,1) || '*'
    ELSE left(w,1) || repeat('*',length(w)-2) || right(w,1) END, ' ' ORDER BY n)
  FROM regexp_split_to_table(trim(p_name), '\s+') WITH ORDINALITY AS words(w,n);
$$;
UPDATE public.leaderboard SET player_name = public.mask_player_name(player_name);

CREATE FUNCTION public.login_player(p_kind text, p_name text, p_pin text, p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_profile public.player_profiles; v_name text := regexp_replace(trim(p_name),'\s+',' ','g');
BEGIN
  IF p_kind NOT IN ('student','guest') OR p_kind IS NULL OR v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 25
    OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid login details' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'student' THEN
    PERFORM 1 FROM public.student_codes WHERE pin = p_pin AND enabled FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid student PIN' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_profile FROM public.player_profiles WHERE pin = p_pin;
    IF FOUND AND lower(v_profile.name) <> lower(v_name) THEN
      RAISE EXCEPTION 'This PIN is registered to another name. Enter your original name.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_profile.id IS NULL THEN
    INSERT INTO public.player_profiles(name,kind,pin) VALUES (v_name,p_kind,CASE WHEN p_kind = 'student' THEN p_pin ELSE NULL END)
      RETURNING * INTO v_profile;
  END IF;
  INSERT INTO public.player_sessions(token_hash,player_id) VALUES (p_hash,v_profile.id);
  RETURN jsonb_build_object('id',v_profile.id,'name',public.mask_player_name(v_profile.name),
    'kind',v_profile.kind,'pin',v_profile.pin,'createdAt',extract(epoch FROM v_profile.created_at)*1000);
END;
$$;

CREATE FUNCTION public.submit_session_score(p_hash text,p_session_id text,p_score integer,p_wpm numeric,p_accuracy numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_profile public.player_profiles; v_result jsonb;
BEGIN
  SELECT p.* INTO v_profile FROM public.player_sessions s JOIN public.player_profiles p ON p.id=s.player_id
    WHERE s.token_hash=p_hash AND s.expires_at > now() FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Please log in again' USING ERRCODE = '28000'; END IF;
  IF v_profile.kind = 'student' AND NOT EXISTS (SELECT 1 FROM public.student_codes WHERE pin=v_profile.pin AND enabled) THEN
    RAISE EXCEPTION 'Please contact your teacher' USING ERRCODE = '28000';
  END IF;
  v_result := public.submit_game_score(p_session_id,v_profile.id::text,public.mask_player_name(v_profile.name),p_score,p_wpm,p_accuracy);
  UPDATE public.leaderboard SET player_type=v_profile.kind,student_pin=v_profile.pin WHERE player_id=v_profile.id::text;
  -- Do not return an outdated metadata snapshot from the underlying score function.
  RETURN v_result - 'record';
END;
$$;
REVOKE ALL ON FUNCTION public.login_player(text,text,text,text), public.submit_session_score(text,text,integer,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.login_player(text,text,text,text), public.submit_session_score(text,text,integer,numeric,numeric) TO service_role;

-- Keep every public write masked, including a cached older client during rollout.
CREATE FUNCTION public.mask_leaderboard_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.player_name := public.mask_player_name(NEW.player_name);
  RETURN NEW;
END;
$$;
CREATE TRIGGER mask_public_names BEFORE INSERT OR UPDATE ON public.leaderboard
FOR EACH ROW EXECUTE FUNCTION public.mask_leaderboard_profile();
