-- SkillType guest account auto-cleanup
-- Guest accounts are removed when their points have not increased for 24 hours.
-- Runs hourly at minute 15 via Supabase pg_cron.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.cleanup_inactive_guest_accounts()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  create temporary table if not exists tmp_stale_guests (
    player_id uuid primary key
  ) on commit drop;

  truncate tmp_stale_guests;

  insert into tmp_stale_guests(player_id)
  select distinct pp.id
  from public.player_profiles pp
  join public.leaderboard lb on lb.player_id = pp.id::text
  where pp.kind = 'guest'
    and lb.last_played_at <= now() - interval '24 hours';

  delete from public.player_sessions ps
  using tmp_stale_guests t
  where ps.player_id = t.player_id;

  delete from public.game_sessions gs
  using tmp_stale_guests t
  where gs.player_id = t.player_id::text;

  delete from public.leaderboard lb
  using tmp_stale_guests t
  where lb.player_id = t.player_id::text;

  delete from public.player_profiles pp
  using tmp_stale_guests t
  where pp.id = t.player_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_inactive_guest_accounts() from public, anon, authenticated;
grant execute on function public.cleanup_inactive_guest_accounts() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'cleanup-inactive-skilltype-guests'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'cleanup-inactive-skilltype-guests',
    '15 * * * *',
    'select public.cleanup_inactive_guest_accounts();'
  );
end
$$;
