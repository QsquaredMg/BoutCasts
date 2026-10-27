-- Bracket "Advance by" toggle: a bracket can advance by FINAL SCORE (existing) or by CROWD VOTES (new).
--
-- Crowd-votes brackets reuse the whole prediction-bracket engine: players fill out the full bracket first, then
-- anyone signed in votes on each matchup. When a matchup's voting window closes the contestant with more votes
-- advances, and every player's pick for that matchup is graded (2^(round-1) points, same as score brackets).
-- Ties are left for the organizer to settle. Free for any signed-in organizer.
--
-- Run each block (between the "BLOCK" lines) separately in the Supabase SQL editor. Safe to re-run.

-- ===== BLOCK 1: columns and the votes table =====
alter table public.pred_slates add column if not exists advance_mode text not null default 'score';
alter table public.pred_slates drop constraint if exists pred_slates_advance_mode_check;
alter table public.pred_slates add constraint pred_slates_advance_mode_check check (advance_mode in ('score','votes'));
alter table public.pred_slates add column if not exists vote_hours integer;
alter table public.pred_games add column if not exists votes_close_at timestamptz;

create table if not exists public.pred_bracket_votes (
  game_id uuid not null references public.pred_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.pred_bracket_teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
alter table public.pred_bracket_votes enable row level security;
-- No policies on purpose: votes are written and counted only through the functions below.

-- ===== BLOCK 2: create a bracket in either mode =====
create or replace function public.create_pred_bracket(
  p_title text, p_teams jsonb, p_round_starts jsonb, p_cap integer,
  p_private boolean default false, p_mode text default 'score', p_vote_hours integer default 24)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare res jsonb; sid uuid; k int; r int; prev timestamptz; cur timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if coalesce(p_mode, 'score') <> 'votes' then
    return public.create_pred_tourney(p_title, p_teams, p_round_starts, p_cap, p_private);
  end if;
  if p_vote_hours is null or p_vote_hours not between 1 and 168 then
    raise exception 'Voting can stay open from 1 to 168 hours per round';
  end if;
  k := coalesce(jsonb_array_length(p_round_starts), 0);
  for r in 2..k loop
    prev := (p_round_starts ->> (r-2))::timestamptz;
    cur := (p_round_starts ->> (r-1))::timestamptz;
    if prev is not null and cur is not null and cur < prev + make_interval(hours => p_vote_hours) then
      raise exception 'Each round must start after the voting for the round before it closes';
    end if;
  end loop;
  res := public.create_pred_tourney(p_title, p_teams, p_round_starts, 1000, p_private);
  sid := (res ->> 'id')::uuid;
  update public.pred_slates
     set advance_mode = 'votes', vote_hours = p_vote_hours, status = 'open', paid_at = now(), opens_at = now(), entrant_cap = 1000
   where id = sid;
  update public.pred_games set votes_close_at = starts_at + make_interval(hours => p_vote_hours) where slate_id = sid and round = 1;
  return res;
end $fn$;
revoke execute on function public.create_pred_bracket(text, jsonb, jsonb, integer, boolean, text, integer) from public, anon;
grant execute on function public.create_pred_bracket(text, jsonb, jsonb, integer, boolean, text, integer) to authenticated;

-- ===== BLOCK 3: voting, counting, and closing a matchup =====
create or replace function public.cast_bracket_vote(p_game uuid, p_team uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); g pred_games; s pred_slates;
begin
  if uid is null then raise exception 'Sign in to vote'; end if;
  select * into g from pred_games where id = p_game;
  if not found then raise exception 'Matchup not found'; end if;
  select * into s from pred_slates where id = g.slate_id;
  if s.advance_mode is distinct from 'votes' or s.status <> 'open' then raise exception 'Voting is not open for this bracket'; end if;
  if g.status <> 'scheduled' or g.home_team_id is null or g.away_team_id is null then raise exception 'Voting is not open for this matchup'; end if;
  if now() < g.starts_at then raise exception 'Voting has not opened yet'; end if;
  if g.votes_close_at is null or now() >= g.votes_close_at then raise exception 'Voting has closed'; end if;
  if p_team not in (g.home_team_id, g.away_team_id) then raise exception 'Pick one of the two contestants'; end if;
  insert into pred_bracket_votes(game_id, user_id, team_id) values (p_game, uid, p_team)
  on conflict (game_id, user_id) do update set team_id = excluded.team_id, created_at = now();
end $fn$;
revoke execute on function public.cast_bracket_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_bracket_vote(uuid, uuid) to authenticated;

create or replace function public.bracket_vote_counts(p_slate uuid)
returns table(game_id uuid, team_id uuid, votes bigint)
language sql stable security definer set search_path = public as $fn$
  select v.game_id, v.team_id, count(*)::bigint
    from pred_bracket_votes v join pred_games g on g.id = v.game_id
   where g.slate_id = p_slate
   group by v.game_id, v.team_id
$fn$;
revoke execute on function public.bracket_vote_counts(uuid) from public;
grant execute on function public.bracket_vote_counts(uuid) to anon, authenticated;

create or replace function public.bracket_my_votes(p_slate uuid)
returns table(game_id uuid, team_id uuid)
language sql stable security definer set search_path = public as $fn$
  select v.game_id, v.team_id
    from pred_bracket_votes v join pred_games g on g.id = v.game_id
   where g.slate_id = p_slate and v.user_id = auth.uid()
$fn$;
revoke execute on function public.bracket_my_votes(uuid) from public, anon;
grant execute on function public.bracket_my_votes(uuid) to authenticated;

-- Internal: tally a matchup, advance the winner, grade everyone's pick. Returns 'final', 'tie', 'open' or 'done'.
create or replace function public._close_bracket_vote_game(p_game uuid, p_winner uuid, p_actor uuid, p_force boolean)
returns text language plpgsql security definer set search_path = public as $fn$
declare g pred_games; s pred_slates; nx pred_games; hv int; av int; v_winner uuid; t record;
begin
  select * into g from pred_games where id = p_game for update;
  if not found then raise exception 'Matchup not found'; end if;
  select * into s from pred_slates where id = g.slate_id;
  if s.advance_mode is distinct from 'votes' then raise exception 'This bracket advances by final score'; end if;
  if s.status = 'pending' then raise exception 'This bracket is not open yet'; end if;
  if g.status <> 'scheduled' then return 'done'; end if;
  if g.home_team_id is null or g.away_team_id is null then raise exception 'Both contestants must be set first'; end if;
  if not p_force and (g.votes_close_at is null or now() < g.votes_close_at) then return 'open'; end if;

  select count(*) filter (where team_id = g.home_team_id), count(*) filter (where team_id = g.away_team_id)
    into hv, av from pred_bracket_votes where game_id = p_game;
  if hv > av then v_winner := g.home_team_id;
  elsif av > hv then v_winner := g.away_team_id;
  else
    if p_winner is null then return 'tie'; end if;
    if p_winner not in (g.home_team_id, g.away_team_id) then raise exception 'Pick one of the two contestants'; end if;
    v_winner := p_winner;
  end if;

  update pred_games
     set status = 'final', home_score = hv, away_score = av, finalized_at = now(),
         finalized_by = coalesce(p_actor, s.created_by), winner_team_id = v_winner
   where id = p_game;

  if g.feeds_game_id is not null then
    select name, logo into t from pred_bracket_teams where id = v_winner;
    if g.feeds_side = 'home' then
      update pred_games set home_team_id = v_winner, home_name = t.name, home_logo = t.logo where id = g.feeds_game_id;
    else
      update pred_games set away_team_id = v_winner, away_name = t.name, away_logo = t.logo where id = g.feeds_game_id;
    end if;
    select * into nx from pred_games where id = g.feeds_game_id;
    if nx.home_team_id is not null and nx.away_team_id is not null then
      update pred_games set votes_close_at = greatest(nx.starts_at, now()) + make_interval(hours => s.vote_hours) where id = nx.id;
    end if;
  end if;

  update pred_bracket_picks bp set
      pts_entry = 0, pts_exact = 0, pts_close = 0,
      pts_winner = case when bp.team_id = v_winner then (2 ^ (g.round - 1))::int else 0 end,
      pts_total  = case when bp.team_id = v_winner then (2 ^ (g.round - 1))::int else 0 end,
      graded_at = now()
   where bp.game_id = p_game;
  return 'final';
end $fn$;
revoke all on function public._close_bracket_vote_game(uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- Organizer (or admin) closes a matchup now. If the vote is tied, they pass the contestant who advances.
create or replace function public.close_bracket_vote_game(p_game uuid, p_winner uuid default null)
returns text language plpgsql security definer set search_path = public as $fn$
declare g pred_games;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into g from pred_games where id = p_game;
  if not found then raise exception 'Matchup not found'; end if;
  if not (g.created_by = auth.uid() or pred_is_admin()) then raise exception 'Only the organizer can close voting'; end if;
  if now() < g.starts_at then raise exception 'Voting has not opened yet'; end if;
  return public._close_bracket_vote_game(p_game, p_winner, auth.uid(), true);
end $fn$;
revoke execute on function public.close_bracket_vote_game(uuid, uuid) from public, anon;
grant execute on function public.close_bracket_vote_game(uuid, uuid) to authenticated;

-- Cron: closes every matchup whose voting window has ended (ties wait for the organizer).
create or replace function public.auto_close_bracket_votes()
returns integer language plpgsql security definer set search_path = public as $fn$
declare r record; n int := 0; res text;
begin
  for r in
    select g.id from pred_games g join pred_slates s on s.id = g.slate_id
     where s.advance_mode = 'votes' and s.status <> 'pending' and g.status = 'scheduled'
       and g.votes_close_at <= now() and g.home_team_id is not null and g.away_team_id is not null
     order by g.round, g.slot limit 100
  loop
    begin
      res := public._close_bracket_vote_game(r.id, null, null, false);
      if res = 'final' then n := n + 1; end if;
    exception when others then null;
    end;
  end loop;
  return n;
end $fn$;
revoke all on function public.auto_close_bracket_votes() from public, anon, authenticated;
grant execute on function public.auto_close_bracket_votes() to service_role;

-- ===== BLOCK 4: entering a bracket (no championship score needed in crowd-votes mode) =====
create or replace function public.submit_bracket(p_bracket uuid, p_picks jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); s pred_slates; n int; total int; tour boolean; votes boolean; k int; fin uuid;
begin
  if uid is null then raise exception 'Sign in to fill out the bracket'; end if;
  select * into s from pred_slates where id = p_bracket for update;
  if not found or s.kind <> 'elimination' then raise exception 'Bracket not found'; end if;
  tour := s.scoring_mode = 'tourney';
  votes := s.advance_mode = 'votes';
  if not pred_slate_is_open(p_bracket) then raise exception 'This bracket is closed to new predictions'; end if;
  if now() >= s.locks_at then raise exception 'Predictions locked when the first game started'; end if;
  if tour and s.entrant_cap is not null
     and not exists (select 1 from pred_bracket_picks where bracket_id = p_bracket and user_id = uid)
     and (select count(distinct user_id) from pred_bracket_picks where bracket_id = p_bracket) >= s.entrant_cap then
    raise exception 'This bracket is full (% entrants)', s.entrant_cap;
  end if;
  select count(*), max(round) into total, k from pred_games where slate_id = p_bracket;
  select id into fin from pred_games where slate_id = p_bracket and round = k limit 1;
  select count(*) into n from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int);
  if n <> total or (select count(distinct game_id) from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)) <> total then
    raise exception 'Fill in every game in the bracket';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)
              where not exists (select 1 from pred_games g where g.id = x.game_id and g.slate_id = p_bracket)) then
    raise exception 'That pick does not belong to this bracket';
  end if;
  if votes then
    null; -- crowd-votes brackets: winners only, no scores
  elsif tour then
    if exists (select 1 from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)
                where x.game_id = fin and (x.win_score is null or x.lose_score is null)) then
      raise exception 'Add your score for the championship game (it breaks ties)';
    end if;
    if exists (select 1 from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)
                where x.game_id = fin and (x.win_score < 0 or x.lose_score < 0 or x.win_score > 999 or x.win_score <= x.lose_score)) then
      raise exception 'The championship score needs a winning score higher than the losing score';
    end if;
  elsif exists (select 1 from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)
              where x.win_score is null or x.lose_score is null or x.win_score < 0 or x.lose_score < 0 or x.win_score > 999 or x.win_score <= x.lose_score) then
    raise exception 'Each game needs a winning score higher than the losing score';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)
      join pred_games g on g.id = x.game_id
     where not (
       (g.round = 1 and x.team_id in (g.home_team_id, g.away_team_id))
       or (g.round > 1 and x.team_id in (
             select p2.team_id from jsonb_to_recordset(p_picks) as p2(game_id uuid, team_id uuid, win_score int, lose_score int)
               join pred_games f on f.id = p2.game_id where f.feeds_game_id = g.id))
     )) then
    raise exception 'Your picks do not form a valid bracket';
  end if;
  insert into pred_bracket_picks(bracket_id, game_id, user_id, team_id, win_score, lose_score)
  select p_bracket, x.game_id, uid, x.team_id,
         case when votes or (tour and x.game_id <> fin) then null else x.win_score end,
         case when votes or (tour and x.game_id <> fin) then null else x.lose_score end
    from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)
  on conflict (game_id, user_id) do update set team_id = excluded.team_id, win_score = excluded.win_score, lose_score = excluded.lose_score, updated_at = now();
end $fn$;

-- ===== BLOCK 5: crowd-votes matchups cannot be scored by hand (the vote decides) =====
create or replace function public.finalize_pred_game(p_game uuid, p_home integer, p_away integer)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); g pred_games; s pred_slates; v_winner uuid; t record; ent int; wp int; tour boolean := false;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from pred_games where id = p_game for update;
  if not found then raise exception 'Game not found'; end if;
  if not (g.created_by = uid or pred_is_admin()) then raise exception 'Only the organizer can enter the final score'; end if;
  if g.status = 'cancelled' then raise exception 'This game was cancelled'; end if;
  if g.slate_id is not null then
    select * into s from pred_slates where id = g.slate_id;
    if s.status = 'pending' then raise exception 'Finish checkout to activate this bracket first'; end if;
    if s.advance_mode = 'votes' then raise exception 'This bracket advances by crowd votes, so scores cannot be entered.'; end if;
    tour := s.scoring_mode = 'tourney';
  end if;
  if now() < g.starts_at then raise exception 'The game has not started yet'; end if;
  if g.status = 'final' and not pred_is_admin() and g.finalized_at < now() - interval '24 hours' then
    raise exception 'Scores can only be corrected within 24 hours. Contact support.';
  end if;
  if p_home is null or p_away is null or p_home < 0 or p_away < 0 or p_home > 999 or p_away > 999 then raise exception 'Enter valid scores'; end if;
  if g.round is not null then
    if g.home_team_id is null or g.away_team_id is null then raise exception 'The earlier round must be final first'; end if;
    if p_home = p_away then raise exception 'Bracket games cannot end in a tie'; end if;
    v_winner := case when p_home > p_away then g.home_team_id else g.away_team_id end;
    if g.status = 'final' and g.winner_team_id is distinct from v_winner and g.feeds_game_id is not null
       and exists (select 1 from pred_games where id = g.feeds_game_id and status = 'final') then
      raise exception 'The next round is already final, so this result cannot change';
    end if;
  elsif p_home = p_away and not g.allow_draw then
    raise exception 'This game cannot end in a tie';
  end if;
  update pred_games set status = 'final', home_score = p_home, away_score = p_away, finalized_at = now(), finalized_by = uid, winner_team_id = v_winner
   where id = p_game;

  if g.round is not null and g.feeds_game_id is not null then
    select name, logo into t from pred_bracket_teams where id = v_winner;
    if g.feeds_side = 'home' then
      update pred_games set home_team_id = v_winner, home_name = t.name, home_logo = t.logo where id = g.feeds_game_id;
    else
      update pred_games set away_team_id = v_winner, away_name = t.name, away_logo = t.logo where id = g.feeds_game_id;
    end if;
  end if;

  ent := case when g.scoring_version = 1 then 2 else 0 end;
  wp := case when g.scoring_version = 1 then 3 else 5 end;

  update pred_predictions p set pts_entry = s2.entry, pts_winner = s2.winner, pts_exact = s2.exact, pts_close = s2.close, pts_total = s2.total, graded_at = now()
    from (select pp.id, (pred_grade_ver(pp.pred_home, pp.pred_away, p_home, p_away, g.scoring_version)).* from pred_predictions pp where pp.game_id = p_game) s2
   where p.id = s2.id;

  if tour and g.round is not null then
    update pred_bracket_picks bp set
        pts_entry = 0, pts_exact = 0, pts_close = 0,
        pts_winner = case when bp.team_id = v_winner then (2 ^ (g.round - 1))::int else 0 end,
        pts_total  = case when bp.team_id = v_winner then (2 ^ (g.round - 1))::int else 0 end,
        graded_at = now()
     where bp.game_id = p_game;
  else
    update pred_bracket_picks bp set
        pts_entry = ent,
        pts_winner = case when bp.team_id = v_winner then wp else 0 end,
        pts_exact = x.ex, pts_close = x.cl,
        pts_total = ent + (case when bp.team_id = v_winner then wp else 0 end) + x.ex + x.cl,
        graded_at = now()
      from (
        select b2.id,
               case when b2.team_id in (g.home_team_id, g.away_team_id) then gr.exact else 0 end as ex,
               case when b2.team_id in (g.home_team_id, g.away_team_id) then gr.close else 0 end as cl
          from pred_bracket_picks b2
          cross join lateral pred_grade(
            case when b2.team_id = g.home_team_id then b2.win_score else b2.lose_score end,
            case when b2.team_id = g.away_team_id then b2.win_score else b2.lose_score end,
            p_home, p_away) gr
         where b2.game_id = p_game
      ) x
     where bp.id = x.id;
  end if;
end $fn$;
