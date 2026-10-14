-- Streaks for every kind of play + "my team" and the team/school rivalry leaderboard.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1) My team ---------------------------------------------------------------
alter table public.profiles add column if not exists favorite_team_id uuid references public.team_directory(id) on delete set null;
create index if not exists profiles_favorite_team_idx on public.profiles (favorite_team_id) where favorite_team_id is not null;

create or replace function public.set_my_team(p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if p_team is not null and not exists (select 1 from team_directory where id = p_team and hidden = false) then
    raise exception 'That team is not available.';
  end if;
  update profiles set favorite_team_id = p_team where id = uid;
  return jsonb_build_object('ok', true, 'team_id', p_team);
end $$;
revoke all on function public.set_my_team(uuid) from public, anon;
grant execute on function public.set_my_team(uuid) to authenticated;

-- 2) Streaks count any play: matchup vote, showcase vote, prediction ----------
-- Streak days are UTC days, same as the existing matchup-vote streak.
create or replace function public.bump_streak(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_last date;
  v_cur integer;
  v_new integer;
begin
  if p_user is null then return; end if;
  select last_vote_date, coalesce(current_streak, 0) into v_last, v_cur from profiles where id = p_user;
  if not found then return; end if;
  if v_last = v_today then return; end if;
  v_new := case when v_last = v_today - 1 then v_cur + 1 else 1 end;
  update profiles
     set current_streak = v_new,
         longest_streak = greatest(coalesce(longest_streak, 0), v_new),
         last_vote_date = v_today
   where id = p_user;
end $$;
revoke all on function public.bump_streak(uuid) from public, anon, authenticated;

-- (Matchup votes already update streaks in handle_vote_insert; this keeps the same UTC day so they agree.)

create or replace function public.streak_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_streak(new.user_id);
  return new;
end $$;
revoke all on function public.streak_after_insert() from public, anon, authenticated;

drop trigger if exists showcase_votes_streak on public.showcase_votes;
create trigger showcase_votes_streak after insert on public.showcase_votes
  for each row when (new.user_id is not null) execute function public.streak_after_insert();

drop trigger if exists pred_predictions_streak on public.pred_predictions;
create trigger pred_predictions_streak after insert on public.pred_predictions
  for each row when (new.user_id is not null) execute function public.streak_after_insert();

-- 3) Team / school rivalry leaderboard ---------------------------------------
-- Ranks teams by the combined points of their fans. Also shows fan count so small schools
-- can compete on pride (points per fan).
create or replace function public.team_leaderboard(p_limit integer default 50, p_league text default null)
returns table (
  team_id uuid, name text, full_name text, league text, conference text, logo_url text,
  fans bigint, points bigint, points_per_fan numeric, best_streak integer
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.full_name, t.league, t.conference, t.logo_url,
         count(*) as fans,
         coalesce(sum(p.points), 0)::bigint as points,
         round(coalesce(sum(p.points), 0)::numeric / count(*), 1) as points_per_fan,
         coalesce(max(case when p.last_vote_date >= (now() at time zone 'utc')::date - 1
                           then p.current_streak else 0 end), 0)::integer as best_streak
    from profiles p
    join team_directory t on t.id = p.favorite_team_id
   where t.hidden = false
     and coalesce(p.is_suspended, false) = false
     and (p_league is null or t.league = p_league)
   group by t.id
   order by points desc, fans desc, t.name
   limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;
revoke all on function public.team_leaderboard(integer, text) from public;
grant execute on function public.team_leaderboard(integer, text) to anon, authenticated;

-- 4) Stadium scale: index the per-event vote count -------------------------------
-- enforce_live_vote_cap counts the event's votes on every insert. Without this index that count
-- scans the whole table, so each vote gets slower as more votes arrive.
create index if not exists live_votes_event_id_idx on public.live_votes (event_id);
