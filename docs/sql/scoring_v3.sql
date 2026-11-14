-- Bout Predictions scoring v3: a sliding scale that adapts to the size of the game.
-- Applies ONLY to games created after this runs. Existing games stay on version 2 (or 1) and keep their points.
--
--   Correct winner (or a correct draw call) ...... +5
--   Margin of victory ............................ up to +3, fading smoothly with the error
--   Combined total score ......................... up to +2, fading smoothly with the error
--   Both scores exact ............................ +1
--   A wrong winner keeps half of the margin + total credit.
--   A perfect call is still 5 + 3 + 2 + 1 = 11 points, so season leaderboards stay fair across versions.
--
-- "Fading" is measured against the final total T = actual home + away:
--   margin credit = 3 * max(0, 1 - |predicted margin - actual margin| / max(3, 0.25 * T))
--   total  credit = 2 * max(0, 1 - |predicted total  - actual total | / max(4, 0.40 * T))
-- so a 3-point miss means little in basketball and a lot in soccer, with no per-sport settings.
-- Margin + total credit (0 to 5, rounded to a whole number) is stored in pts_close; the exact bonus in pts_exact.

create or replace function public.pred_grade_ver(ph integer, pa integer, ah integer, aa integer, ver integer)
returns table(entry integer, winner integer, exact integer, close integer, total integer)
language plpgsql immutable set search_path = public as $fn$
declare
  w int; x int; c int; e int;
  pm int := ph - pa; am int := ah - aa;
  ptot int := ph + pa; atot int := ah + aa;
  mtol numeric; ttol numeric; raw numeric;
begin
  if ver >= 3 then
    w := case when sign(pm) = sign(am) then 5 else 0 end;
    x := case when ph = ah and pa = aa then 1 else 0 end;
    mtol := greatest(3::numeric, 0.25 * atot);
    ttol := greatest(4::numeric, 0.40 * atot);
    raw := 3 * greatest(0::numeric, 1 - abs(pm - am) / mtol)
         + 2 * greatest(0::numeric, 1 - abs(ptot - atot) / ttol);
    if w = 0 then raw := raw * 0.5; end if;
    c := round(raw)::int;
    return query select 0, w, x, c, w + x + c;
  else
    return query
      select (case when ver = 1 then 2 else 0 end),
             (case when gr.winner > 0 then (case when ver = 1 then 3 else 5 end) else 0 end),
             gr.exact, gr.close,
             (case when ver = 1 then 2 else 0 end) + (case when gr.winner > 0 then (case when ver = 1 then 3 else 5 end) else 0 end) + gr.exact + gr.close
        from public.pred_grade(ph, pa, ah, aa) gr;
  end if;
end $fn$;

-- Bracket picks (pred_bracket_picks) are graded inside finalize_pred_game. The only change from the
-- previous version is that its exact/close part now goes through pred_grade_ver with the game's version.
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
          cross join lateral pred_grade_ver(
            case when b2.team_id = g.home_team_id then b2.win_score else b2.lose_score end,
            case when b2.team_id = g.away_team_id then b2.win_score else b2.lose_score end,
            p_home, p_away, g.scoring_version) gr
         where b2.game_id = p_game
      ) x
     where bp.id = x.id;
  end if;
end $fn$;

-- New games use version 3. Existing rows keep the version they were created with.
alter table public.pred_games alter column scoring_version set default 3;

-- Leaderboards count a "perfect call" (both scores exact) as pts_exact = 6 on v1/v2 games.
-- On v3 games both-exact is stored as pts_exact = 1, so count either. (v1/v2 only ever store 0, 2 or 6.)
create or replace function public.pred_leaderboard(p_scope text, p_slate uuid default null::uuid, p_limit integer default 25)
returns table(user_id uuid, username text, avatar_url text, points bigint, games bigint, winners bigint, perfect bigint)
language sql stable security definer set search_path = public as $fn$
  with pts as (
    select p.user_id, p.pts_total, p.pts_winner, p.pts_exact, g.slate_id, g.starts_at, g.is_private
      from pred_predictions p join pred_games g on g.id = p.game_id
     where p.graded_at is not null and g.status = 'final'
    union all
    select b.user_id, b.pts_total, b.pts_winner, b.pts_exact, g.slate_id, g.starts_at, g.is_private
      from pred_bracket_picks b join pred_games g on g.id = b.game_id
     where b.graded_at is not null and g.status = 'final'
  )
  select x.user_id, pr.username, pr.avatar_url, sum(x.pts_total)::bigint, count(*)::bigint,
         count(*) filter (where x.pts_winner > 0)::bigint, count(*) filter (where x.pts_exact in (1, 6))::bigint
    from pts x
    left join profiles pr on pr.id = x.user_id
   where case
           when p_slate is not null then x.slate_id = p_slate
           when p_scope = 'week' then x.starts_at >= now() - interval '7 days' and not x.is_private
           else x.starts_at >= date_trunc('year', now()) and not x.is_private
         end
   group by x.user_id, pr.username, pr.avatar_url
   order by 4 desc, 7 desc, 6 desc, 5 desc, pr.username
   limit least(greatest(p_limit,1),100)
$fn$;

create or replace function public.pred_entrant_standings(p_slate uuid)
returns table(entrant_name text, points bigint, games bigint, winners bigint, perfect bigint)
language sql stable security definer set search_path = public as $fn$
  select min(e.entrant_name), sum(e.pts_total)::bigint, count(*)::bigint,
         count(*) filter (where e.pts_winner > 0)::bigint, count(*) filter (where e.pts_exact in (1, 6))::bigint
    from pred_entrant_picks e join pred_games g on g.id = e.game_id
   where g.slate_id = p_slate and g.status = 'final' and e.graded_at is not null
   group by lower(btrim(e.entrant_name))
   order by 2 desc
   limit 100
$fn$;
