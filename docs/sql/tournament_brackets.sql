-- Tournament brackets: March Madness style pools for anyone (organizers, not just admins).
--
-- Builds on the existing elimination bracket (pred_slates kind='elimination', pred_games rounds, pred_bracket_picks).
-- Existing brackets keep their original scoring ("classic"). New ones use scoring_mode = 'tourney':
--   * Each correct winner pick earns 2^(round-1) points (1, 2, 4, 8, 16, 32 ...). Wins/losses are the primary grade.
--   * Score predictions are only a tie-breaker, taken from the championship game only:
--       1) closest to the championship's combined score, 2) closest to its margin, 3) more correct picks, 4) earlier entry.
--   * Picks lock 15 minutes after Round 1 starts (same rule as before). Players always play free.
--   * Organizer pays once to publish, by entrant limit: 16 / 64 / 250 / 1,000 entrants. Admins open brackets free.
-- Paste this whole file into the Supabase SQL editor and run it once. Safe to re-run.

alter table pred_slates add column if not exists scoring_mode text not null default 'classic';
alter table pred_slates add column if not exists entrant_cap integer;

alter table pred_slates drop constraint if exists pred_slates_scoring_mode_check;
alter table pred_slates add constraint pred_slates_scoring_mode_check check (scoring_mode in ('classic','tourney'));
alter table pred_slates drop constraint if exists pred_slates_tier_check;
alter table pred_slates add constraint pred_slates_tier_check check (tier = any (array['weekly','season','private','tourney']));
alter table pred_slates drop constraint if exists pred_slates_bracket_size_check;
alter table pred_slates add constraint pred_slates_bracket_size_check check (bracket_size = any (array[4,8,16,32,64]));

-- Tournament entries only need a score for the championship game, so earlier picks may have no score.
alter table pred_bracket_picks alter column win_score drop not null;
alter table pred_bracket_picks alter column lose_score drop not null;
alter table pred_bracket_picks drop constraint if exists pred_bracket_picks_check;
alter table pred_bracket_picks add constraint pred_bracket_picks_check check (
  (win_score is null and lose_score is null)
  or (win_score is not null and lose_score is not null and lose_score >= 0 and lose_score < win_score and win_score <= 999)
);

-- 1. Create a tournament bracket (a draft until the organizer pays; admins can open it free).
create or replace function create_pred_tourney(p_title text, p_teams jsonb, p_round_starts jsonb, p_cap integer, p_private boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  adm boolean := coalesce(pred_is_admin(), false);
  sid uuid := gen_random_uuid();
  n int; k int; r int; sl int; i int; cnt int; tries int := 0;
  starts timestamptz[]; st timestamptz; t jsonb; tids uuid[] := '{}'; tid uuid; gid uuid;
  cur uuid[]; nxt uuid[]; code text := null;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if btrim(coalesce(p_title,'')) = '' or char_length(btrim(p_title)) not between 3 and 80 then
    raise exception 'Give the bracket a name (3 to 80 characters)';
  end if;
  if p_cap is null or not (p_cap in (16,64,250,1000) or (adm and p_cap between 2 and 100000)) then
    raise exception 'Choose how many entrants: 16, 64, 250 or 1,000';
  end if;
  if not adm and (select count(*) from pred_slates where created_by = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Slow down: too many brackets started today';
  end if;
  n := coalesce(jsonb_array_length(p_teams), 0);
  if n not in (4,8,16,32,64) then raise exception 'A tournament bracket needs 4, 8, 16, 32 or 64 teams'; end if;
  k := round(log(2, n))::int;
  if coalesce(jsonb_array_length(p_round_starts), 0) <> k then raise exception 'Set a start time for each of the % rounds', k; end if;
  for r in 1..k loop
    st := (p_round_starts ->> (r-1))::timestamptz;
    if st is null or st <= now() + interval '1 minute' then raise exception 'Every round needs a start time in the future'; end if;
    if r > 1 and st <= starts[r-1] then raise exception 'Each round must start after the one before it'; end if;
    starts[r] := st;
  end loop;
  if starts[k] > now() + interval '1 year' then raise exception 'The final must start within a year'; end if;
  if (select count(distinct lower(btrim(x ->> 'name'))) from jsonb_array_elements(p_teams) x) <> n
     or exists (select 1 from jsonb_array_elements(p_teams) x where btrim(coalesce(x ->> 'name','')) = '' or char_length(btrim(x ->> 'name')) > 40) then
    raise exception 'Every team needs a different name (40 characters max)';
  end if;

  if p_private then
    loop
      code := '';
      for i in 1..6 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
      exit when not exists (select 1 from pred_slates where invite_code = code);
      tries := tries + 1;
      if tries > 20 then raise exception 'Could not make an invite code, try again'; end if;
    end loop;
  end if;

  insert into pred_slates(id, title, created_by, kind, tier, status, bracket_size, locks_at, scoring_mode, entrant_cap, visibility, invite_code)
  values (sid, btrim(p_title), uid, 'elimination', 'tourney', 'pending', n, starts[1] + pred_lock_grace(), 'tourney', p_cap,
          case when p_private then 'private' else 'public' end, code);

  for i in 1..n loop
    t := p_teams -> (i-1);
    tid := gen_random_uuid();
    insert into pred_bracket_teams(id, bracket_id, seed, name, logo)
    values (tid, sid, i, btrim(t ->> 'name'), nullif(btrim(coalesce(t ->> 'logo','')),''));
    tids[i] := tid;
  end loop;

  nxt := '{}';
  for r in reverse k..1 loop
    cnt := n / (2 ^ r)::int;
    cur := '{}';
    for sl in 1..cnt loop
      gid := gen_random_uuid();
      if r = 1 then
        insert into pred_games(id, slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, dup_key, round, slot, home_team_id, away_team_id, feeds_game_id, feeds_side, is_private)
        select gid, sid, uid, h.name, h.logo, a.name, a.logo, starts[r], 'elim|' || gid::text, r, sl, h.id, a.id,
               case when r < k then nxt[(sl+1)/2] end, case when r < k then (case when sl % 2 = 1 then 'home' else 'away' end) end, p_private
          from pred_bracket_teams h, pred_bracket_teams a where h.id = tids[2*sl-1] and a.id = tids[2*sl];
      else
        insert into pred_games(id, slate_id, created_by, home_name, away_name, starts_at, dup_key, round, slot, feeds_game_id, feeds_side, is_private)
        values (gid, sid, uid, 'TBD', 'TBD', starts[r], 'elim|' || gid::text, r, sl,
                case when r < k then nxt[(sl+1)/2] end, case when r < k then (case when sl % 2 = 1 then 'home' else 'away' end) end, p_private);
      end if;
      cur[sl] := gid;
    end loop;
    nxt := cur;
  end loop;
  return jsonb_build_object('ok', true, 'id', sid);
end $$;
revoke execute on function create_pred_tourney(text, jsonb, jsonb, integer, boolean) from public, anon;
grant execute on function create_pred_tourney(text, jsonb, jsonb, integer, boolean) to authenticated;

-- 2. Opening a paid tournament keeps its tier and never auto-closes (the organizer closes it).
create or replace function activate_pred_bracket(p_id uuid, p_session text, p_tier text)
returns boolean language plpgsql security definer set search_path = public as $$
declare x uuid;
begin
  update pred_slates set status = 'open',
         tier = case when tier = 'tourney' then 'tourney' else p_tier end,
         paid_at = now(), opens_at = now(), stripe_session_id = p_session,
         closes_at = case when tier <> 'tourney' and p_tier = 'weekly' then now() + interval '8 days' else null end
   where id = p_id and status = 'pending' returning id into x;
  return x is not null;
end $$;

-- 3. Entering a bracket: tournament entries need a score only for the championship game, and respect the entrant limit.
create or replace function submit_bracket(p_bracket uuid, p_picks jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s pred_slates; n int; total int; tour boolean; k int; fin uuid;
begin
  if uid is null then raise exception 'Sign in to fill out the bracket'; end if;
  select * into s from pred_slates where id = p_bracket for update;
  if not found or s.kind <> 'elimination' then raise exception 'Bracket not found'; end if;
  tour := s.scoring_mode = 'tourney';
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
  if tour then
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
         case when tour and x.game_id <> fin then null else x.win_score end,
         case when tour and x.game_id <> fin then null else x.lose_score end
    from jsonb_to_recordset(p_picks) as x(game_id uuid, team_id uuid, win_score int, lose_score int)
  on conflict (game_id, user_id) do update set team_id = excluded.team_id, win_score = excluded.win_score, lose_score = excluded.lose_score, updated_at = now();
end $$;

-- 4. Grading: tournament brackets score 2^(round-1) per correct winner and nothing for scores (scores only break ties).
create or replace function finalize_pred_game(p_game uuid, p_home integer, p_away integer)
returns void language plpgsql security definer set search_path = public as $$
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
end $$;

-- 5. The tournament leaderboard: points, wins, losses, best-case points still alive, and the tie-break values.
create or replace function tourney_leaderboard(p_slate uuid, p_limit integer default 100)
returns table(user_id uuid, username text, avatar_url text, points bigint, wins bigint, losses bigint,
              max_points bigint, champ_diff integer, margin_diff integer, entered_at timestamptz)
language sql stable security definer set search_path = public as $$
  with fin as (
    select g.id, g.home_score + g.away_score as tot, abs(g.home_score - g.away_score) as mar
      from pred_games g
     where g.slate_id = p_slate and g.status = 'final'
       and g.round = (select max(round) from pred_games where slate_id = p_slate)
  ),
  dead as (
    select distinct case when g.winner_team_id = g.home_team_id then g.away_team_id else g.home_team_id end as team_id
      from pred_games g where g.slate_id = p_slate and g.status = 'final' and g.round is not null
  ),
  agg as (
    select b.user_id,
           coalesce(sum(b.pts_total), 0) as points,
           count(*) filter (where b.graded_at is not null and coalesce(b.pts_winner, 0) > 0) as wins,
           count(*) filter (where b.graded_at is not null and coalesce(b.pts_winner, 0) = 0) as losses,
           coalesce(sum(case when b.graded_at is null and d.team_id is null then (2 ^ (g.round - 1))::int else 0 end), 0) as alive_pts,
           min(b.created_at) as entered_at
      from pred_bracket_picks b
      join pred_games g on g.id = b.game_id
      left join dead d on d.team_id = b.team_id
     where b.bracket_id = p_slate
       and exists (select 1 from pred_slates s where s.id = p_slate and s.scoring_mode = 'tourney')
     group by b.user_id
  )
  select a.user_id, pr.username, pr.avatar_url, a.points::bigint, a.wins::bigint, a.losses::bigint,
         (a.points + a.alive_pts)::bigint,
         (select abs((cp.win_score + cp.lose_score) - f.tot) from pred_bracket_picks cp join fin f on f.id = cp.game_id where cp.user_id = a.user_id),
         (select abs((cp.win_score - cp.lose_score) - f.mar) from pred_bracket_picks cp join fin f on f.id = cp.game_id where cp.user_id = a.user_id),
         a.entered_at
    from agg a
    left join profiles pr on pr.id = a.user_id
   order by a.points desc, 8 asc nulls last, 9 asc nulls last, a.wins desc, a.entered_at asc
   limit least(greatest(p_limit, 1), 500)
$$;
revoke execute on function tourney_leaderboard(uuid, integer) from public;
grant execute on function tourney_leaderboard(uuid, integer) to anon, authenticated;
