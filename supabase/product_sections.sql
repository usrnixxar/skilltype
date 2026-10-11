ALTER TABLE public.gift_slides ADD COLUMN section text NOT NULL DEFAULT 'showcase' CHECK (section IN ('showcase','achievement'));
CREATE UNIQUE INDEX gift_slides_one_achievement ON public.gift_slides(section) WHERE section='achievement' AND enabled;

CREATE OR REPLACE FUNCTION public.admin_manage(p_hash text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_admin uuid;
  v_section text;
  v_target text;
  v_pin text;
  v_search text := left(coalesce(p_payload->>'search',''),80);
  v_page integer := greatest(0,least(100000,coalesce((p_payload->>'page')::integer,0)));
  v_gift public.gift_slides;
  v_items jsonb;
  v_total integer;
BEGIN
  SELECT player_id INTO v_admin FROM public.player_sessions
  WHERE token_hash=p_hash AND expires_at > statement_timestamp() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Please log in again' USING ERRCODE='28000'; END IF;
  IF v_admin <> '5c99b1c8-e130-4c27-a750-88e35362c581'::uuid THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';
  END IF;
  IF p_action='auth' THEN RETURN jsonb_build_object('authorized',true); END IF;
  IF p_action='players' THEN
    WITH all_players AS (
      SELECT id::text AS id,name,kind,created_at FROM public.player_profiles
      UNION ALL
      SELECT lb.player_id,max(lb.player_name),coalesce(max(lb.player_type),'guest'),min(lb.created_at)
      FROM public.leaderboard lb WHERE NOT EXISTS (SELECT 1 FROM public.player_profiles p WHERE p.id::text=lb.player_id)
      GROUP BY lb.player_id
    ), filtered AS (
      SELECT * FROM all_players WHERE id<>v_admin::text
        AND (strpos(lower(name),lower(v_search))>0 OR strpos(id,v_search)>0)
    ), page_rows AS (
      SELECT f.*,coalesce((SELECT sum(weekly_points) FROM public.leaderboard l WHERE l.player_id=f.id),0) AS points
      FROM filtered f ORDER BY created_at DESC,id LIMIT 25 OFFSET v_page*25
    ) SELECT coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM page_rows r),'[]'::jsonb),
      (SELECT count(*) FROM filtered) INTO v_items,v_total;
    RETURN jsonb_build_object('players',v_items,'total',v_total,'page',v_page);
  END IF;
  IF p_action='delete-player' THEN
    v_target:=p_payload->>'playerId';
    IF v_target IS NULL OR length(v_target) NOT BETWEEN 1 AND 128 OR p_payload->>'confirm' IS DISTINCT FROM 'DELETE' THEN
      RAISE EXCEPTION 'Type DELETE to confirm' USING ERRCODE='22023'; END IF;
    IF v_target=v_admin::text THEN RAISE EXCEPTION 'Admin account cannot be deleted' USING ERRCODE='42501'; END IF;
    SELECT pin INTO v_pin FROM public.player_profiles WHERE id::text=v_target;
    IF v_pin IS NOT NULL THEN
      PERFORM 1 FROM public.student_codes WHERE pin=v_pin FOR UPDATE;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_target,0));
    PERFORM 1 FROM public.player_profiles WHERE id::text=v_target FOR UPDATE;
    IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.leaderboard WHERE player_id=v_target)
       AND NOT EXISTS(SELECT 1 FROM public.deleted_players WHERE player_id=v_target) THEN
      RAISE EXCEPTION 'Player not found' USING ERRCODE='22023'; END IF;
    INSERT INTO public.deleted_players(player_id) VALUES(v_target) ON CONFLICT DO NOTHING;
    DELETE FROM public.player_sessions WHERE player_id::text=v_target;
    DELETE FROM public.game_sessions WHERE player_id=v_target;
    DELETE FROM public.leaderboard WHERE player_id=v_target;
    DELETE FROM public.player_profiles WHERE id::text=v_target;
    IF v_pin IS NOT NULL THEN UPDATE public.student_codes SET enabled=false WHERE pin=v_pin; END IF;
    INSERT INTO public.admin_action_log(action,target_id) VALUES(p_action,v_target);
    RETURN jsonb_build_object('deleted',true);
  END IF;
  IF p_action='gifts' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY sort_order,created_at),'[]'::jsonb) INTO v_items FROM public.gift_slides g;
    RETURN jsonb_build_object('gifts',v_items);
  END IF;
  IF p_action='save-gift' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('skilltype-product-selection',0));
    SELECT section INTO v_section FROM public.gift_slides WHERE id=(p_payload->>'id')::uuid;
    v_section := coalesce(v_section,p_payload->>'section','showcase');
    IF v_section NOT IN ('showcase','achievement') THEN RAISE EXCEPTION 'Invalid product section' USING ERRCODE='22023'; END IF;
    IF v_section='achievement' AND coalesce((p_payload->>'enabled')::boolean,true) THEN
      UPDATE public.gift_slides SET enabled=false WHERE section='achievement' AND enabled AND id<>(p_payload->>'id')::uuid;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='gift-images' AND name=p_payload->>'imagePath') THEN
      RAISE EXCEPTION 'Upload the image first' USING ERRCODE='22023'; END IF;
    INSERT INTO public.gift_slides(id,title,image_path,enabled,sort_order,section)
    VALUES ((p_payload->>'id')::uuid,trim(p_payload->>'title'),p_payload->>'imagePath',
      coalesce((p_payload->>'enabled')::boolean,true),coalesce((p_payload->>'sortOrder')::integer,0),v_section)
    ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,enabled=EXCLUDED.enabled,sort_order=EXCLUDED.sort_order
    RETURNING * INTO v_gift;
    INSERT INTO public.admin_action_log(action,target_id) VALUES(p_action,v_gift.id::text);
    RETURN jsonb_build_object('gift',to_jsonb(v_gift));
  END IF;
  IF p_action='delete-gift' THEN
    DELETE FROM public.gift_slides WHERE id=(p_payload->>'id')::uuid RETURNING * INTO v_gift;
    IF FOUND THEN INSERT INTO public.admin_action_log(action,target_id) VALUES(p_action,v_gift.id::text); END IF;
    RETURN jsonb_build_object('deleted',true);
  END IF;
  RAISE EXCEPTION 'Unknown admin action' USING ERRCODE='22023';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_manage(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage(text,text,jsonb) TO service_role;
