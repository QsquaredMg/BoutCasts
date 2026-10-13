-- Admin overrides + reopen
-- 1) Admins skip the limiting rules (24-hour single-game window, daily creation
--    caps, free-event limits, the 42-hour bout window). Everyone else is unchanged.
-- 2) Admins can reopen locked or closed bouts, Live Vote events, showcases and
--    prediction games.
-- Safe to run more than once. Paste the whole file into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1a) Bout window: the 42-hour table check becomes a trigger that skips admins
-- ---------------------------------------------------------------------------
alter table public.bouts drop constraint if exists bouts_closes_at_max_42h;

create or replace function public.bouts_enforce_max_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.closes_at is not null
     and new.closes_at > new.created_at + interval '42 hours'
     and (tg_op = 'INSERT' or new.closes_at is distinct from old.closes_at)
     and not coalesce(public.pred_is_admin(), false) then
    raise exception 'A bout can stay open for at most 42 hours';
  end if;
  return new;
end
$fn$;

drop trigger if exists bouts_enforce_max_window on public.bouts;
create trigger bouts_enforce_max_window
  before insert or update of closes_at on public.bouts
  for each row execute function public.bouts_enforce_max_window();

-- ---------------------------------------------------------------------------
-- 1b) Prediction games: admins can move a single game past 24 hours
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_pred_game(p_game uuid, p_starts_at timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  uid uuid := auth.uid();
  g pred_games;
  adm boolean := coalesce(pred_is_admin(), false);
begin
  perform 1 from pred_games where id = p_game for update;
  g := (select z from pred_games z where z.id = p_game);
  if g.id is null or g.status <> 'scheduled' or g.round is not null or not (g.created_by = uid or adm) then
    raise exception 'Cannot change this game';
  end if;
  if now() >= g.starts_at and not adm then raise exception 'The game already started'; end if;
  if p_starts_at <= now() + interval '1 minute' then raise exception 'Start time must be in the future'; end if;
  if not adm and g.slate_id is null and p_starts_at > now() + interval '24 hours' then
    raise exception 'A free single game must start within 24 hours';
  end if;
  if exists (select 1 from pred_games where dup_key = g.dup_key and id <> g.id and status <> 'cancelled' and starts_at between p_starts_at - interval '3 hours' and p_starts_at + interval '3 hours') then
    raise exception 'This Bout is already in progress';
  end if;
  update pred_games set starts_at = p_starts_at where id = p_game;
end
$fn$;

-- ---------------------------------------------------------------------------
-- 1c) Daily creation caps: admins are exempt
-- ---------------------------------------------------------------------------
create or replace function public.create_pred_slate(p_title text, p_week_start date)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  uid uuid := auth.uid();
  sid uuid := gen_random_uuid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if not coalesce(pred_is_admin(), false)
     and (select count(*) from pred_slates where created_by = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Slow down: too many weekly slates today';
  end if;
  insert into pred_slates(id, title, week_start, created_by) values (sid, btrim(p_title), coalesce(p_week_start, current_date), uid);
  return sid;
end
$fn$;

create or replace function public.create_pred_private(p_title text, p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  uid uuid := auth.uid();
  adm boolean := coalesce(pred_is_admin(), false);
  sid uuid := gen_random_uuid();
  n int; i int; ga jsonb; st timestamptz; code text; tries int := 0;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if btrim(coalesce(p_title,'')) = '' or char_length(btrim(p_title)) not between 3 and 80 then
    raise exception 'Give your private game a name (3 to 80 characters)';
  end if;
  if not adm and (select count(*) from pred_slates where created_by = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Slow down: too many games started today';
  end if;
  n := coalesce(jsonb_array_length(p_games), 0);
  if n < 1 or n > (case when adm then 64 else 20 end) then
    raise exception 'Add between 1 and % games', (case when adm then 64 else 20 end);
  end if;
  for i in 1..n loop
    ga := p_games -> (i-1);
    if btrim(coalesce(ga ->> 'home_name','')) = '' or btrim(coalesce(ga ->> 'away_name','')) = ''
       or char_length(btrim(ga ->> 'home_name')) > 40 or char_length(btrim(ga ->> 'away_name')) > 40 then
      raise exception 'Game % needs two team names (40 characters max)', i;
    end if;
    if lower(btrim(ga ->> 'home_name')) = lower(btrim(ga ->> 'away_name')) then raise exception 'Game % needs two different teams', i; end if;
    st := (ga ->> 'starts_at')::timestamptz;
    if st is null or st <= now() + interval '1 minute' then raise exception 'Game % needs a start time in the future', i; end if;
    if st > now() + interval '1 year' then raise exception 'Game % starts too far away', i; end if;
  end loop;

  loop
    code := '';
    for i in 1..6 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from pred_slates where invite_code = code);
    tries := tries + 1;
    if tries > 20 then raise exception 'Could not make an invite code, try again'; end if;
  end loop;

  insert into pred_slates(id, title, created_by, kind, tier, status, visibility, invite_code)
  values (sid, btrim(p_title), uid, 'slate', 'private', 'pending', 'private', code);
  for i in 1..n loop
    ga := p_games -> (i-1);
    insert into pred_games(id, slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, allow_draw, dup_key, is_private)
    select g, sid, uid, btrim(ga ->> 'home_name'), nullif(btrim(coalesce(ga ->> 'home_logo','')),''),
           btrim(ga ->> 'away_name'), nullif(btrim(coalesce(ga ->> 'away_logo','')),''),
           (ga ->> 'starts_at')::timestamptz, coalesce((ga ->> 'allow_draw')::boolean, false), 'private|' || g::text, true
      from (select gen_random_uuid() g) x;
  end loop;
  return jsonb_build_object('ok', true, 'id', sid, 'code', code, 'games', n);
end
$fn$;

create or replace function public.create_pred_bracket(p_title text, p_kind text, p_tier text, p_teams jsonb, p_round_starts jsonb, p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  uid uuid := auth.uid();
  adm boolean := coalesce(pred_is_admin(), false);
  sid uuid := gen_random_uuid();
  horizon timestamptz; n int; k int; r int; sl int; i int;
  starts timestamptz[]; t jsonb; tids uuid[] := '{}'; tid uuid; nm text;
  cur uuid[]; nxt uuid[]; gid uuid; cnt int; ga jsonb; key text; dup uuid; st timestamptz;
  batch_keys text[] := '{}'; batch_times timestamptz[] := '{}'; j int;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if btrim(coalesce(p_title,'')) = '' or char_length(btrim(p_title)) not between 3 and 80 then raise exception 'Give the bracket a name (3 to 80 characters)'; end if;
  if p_kind not in ('slate','elimination') then raise exception 'Unknown bracket type'; end if;
  if p_tier not in ('weekly','season') then raise exception 'Unknown plan'; end if;
  if not adm and (select count(*) from pred_slates where created_by = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Slow down: too many brackets started today';
  end if;
  horizon := case when p_tier = 'weekly' and not adm then now() + interval '8 days' else now() + interval '1 year' end;

  if p_kind = 'elimination' then
    n := coalesce(jsonb_array_length(p_teams), 0);
    if n not in (4,8,16,32) then raise exception 'An elimination bracket needs 4, 8, 16 or 32 teams'; end if;
    k := round(log(2, n))::int;
    if coalesce(jsonb_array_length(p_round_starts), 0) <> k then raise exception 'Set a start time for each of the % rounds', k; end if;
    for r in 1..k loop
      st := (p_round_starts ->> (r-1))::timestamptz;
      if st is null or st <= now() + interval '1 minute' then raise exception 'Every round needs a start time in the future'; end if;
      if r > 1 and st <= starts[r-1] then raise exception 'Each round must start after the one before it'; end if;
      starts[r] := st;
    end loop;
    if starts[k] > (case when p_tier = 'weekly' and not adm then now() + interval '7 days' else horizon end) then
      raise exception 'The final must start within % days for this plan', case when p_tier = 'weekly' then 7 else 365 end;
    end if;
    if (select count(distinct lower(btrim(x ->> 'name'))) from jsonb_array_elements(p_teams) x) <> n
       or exists (select 1 from jsonb_array_elements(p_teams) x where btrim(coalesce(x ->> 'name','')) = '' or char_length(btrim(x ->> 'name')) > 40) then
      raise exception 'Every team needs a different name (40 characters max)';
    end if;
    insert into pred_slates(id, title, created_by, kind, tier, status, bracket_size, locks_at)
    values (sid, btrim(p_title), uid, 'elimination', p_tier, 'pending', n, starts[1] + pred_lock_grace());
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
          insert into pred_games(id, slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, dup_key, round, slot, home_team_id, away_team_id, feeds_game_id, feeds_side)
          select gid, sid, uid, h.name, h.logo, a.name, a.logo, starts[r], 'elim|' || gid::text, r, sl, h.id, a.id,
                 case when r < k then nxt[(sl+1)/2] end, case when r < k then (case when sl % 2 = 1 then 'home' else 'away' end) end
            from pred_bracket_teams h, pred_bracket_teams a where h.id = tids[2*sl-1] and a.id = tids[2*sl];
        else
          insert into pred_games(id, slate_id, created_by, home_name, away_name, starts_at, dup_key, round, slot, feeds_game_id, feeds_side)
          values (gid, sid, uid, 'TBD', 'TBD', starts[r], 'elim|' || gid::text, r, sl,
                  case when r < k then nxt[(sl+1)/2] end, case when r < k then (case when sl % 2 = 1 then 'home' else 'away' end) end);
        end if;
        cur[sl] := gid;
      end loop;
      nxt := cur;
    end loop;
    return jsonb_build_object('ok', true, 'id', sid);
  end if;

  n := coalesce(jsonb_array_length(p_games), 0);
  if n < 1 or n > 64 then raise exception 'Add between 1 and 64 games'; end if;
  for i in 1..n loop
    ga := p_games -> (i-1);
    if btrim(coalesce(ga ->> 'home_name','')) = '' or btrim(coalesce(ga ->> 'away_name','')) = ''
       or char_length(btrim(ga ->> 'home_name')) > 40 or char_length(btrim(ga ->> 'away_name')) > 40 then
      raise exception 'Game % needs two team names (40 characters max)', i;
    end if;
    if lower(btrim(ga ->> 'home_name')) = lower(btrim(ga ->> 'away_name')) then raise exception 'Game % needs two different teams', i; end if;
    st := (ga ->> 'starts_at')::timestamptz;
    if st is null or st <= now() + interval '1 minute' then raise exception 'Game % needs a start time in the future', i; end if;
    if st > horizon then raise exception 'Game % starts after this plan''s window closes', i; end if;
    key := pred_dup_key(ga ->> 'home_name', ga ->> 'away_name');
    dup := (select id from pred_games where dup_key = key and status <> 'cancelled'
       and starts_at between st - interval '3 hours' and st + interval '3 hours' limit 1);
    if dup is not null then return jsonb_build_object('ok', false, 'duplicate', true, 'existing_id', dup, 'index', i); end if;
    for j in 1..coalesce(array_length(batch_keys,1),0) loop
      if batch_keys[j] = key and abs(extract(epoch from (batch_times[j] - st))) <= 10800 then
        raise exception 'Games % and % are the same matchup at nearly the same time', j, i;
      end if;
    end loop;
    batch_keys := batch_keys || key; batch_times := batch_times || st;
  end loop;
  insert into pred_slates(id, title, created_by, kind, tier, status) values (sid, btrim(p_title), uid, 'slate', p_tier, 'pending');
  for i in 1..n loop
    ga := p_games -> (i-1);
    insert into pred_games(slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, allow_draw, dup_key)
    values (sid, uid, btrim(ga ->> 'home_name'), nullif(btrim(coalesce(ga ->> 'home_logo','')),''), btrim(ga ->> 'away_name'),
            nullif(btrim(coalesce(ga ->> 'away_logo','')),''), (ga ->> 'starts_at')::timestamptz,
            coalesce((ga ->> 'allow_draw')::boolean, false), pred_dup_key(ga ->> 'home_name', ga ->> 'away_name'));
  end loop;
  return jsonb_build_object('ok', true, 'id', sid);
end
$fn$;

-- ---------------------------------------------------------------------------
-- 1d) Free Live Vote events: admins skip the tier, branding and frequency limits
-- ---------------------------------------------------------------------------
create or replace function public.activate_free_live_vote_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  e live_vote_events;
  n_live int;
  n_recent int;
  adm boolean := coalesce(pred_is_admin(), false);
begin
  e := (select z from live_vote_events z where z.id = p_event_id);
  if e.id is null or e.organizer_id <> auth.uid() then raise exception 'Event not found'; end if;
  if e.status <> 'draft' then raise exception 'This event is already live or closed'; end if;
  if e.tier <> 'free' then raise exception 'Only Free events can go live without checkout'; end if;
  if exists (select 1 from profiles where id = auth.uid() and is_suspended) then raise exception 'Your account is suspended'; end if;
  if not adm then
    if e.scoring_mode <> 'crowd' or e.voting_method <> 'single' then
      raise exception 'Ranked choice and judges panels need a paid tier';
    end if;
    if e.brand_name is not null or e.brand_logo_url is not null or e.post_vote_graphic_url is not null
       or e.brand_color is not null or e.brand_bg_color is not null or e.white_label
       or exists (select 1 from live_vote_sponsors s where s.event_id = e.id) then
      raise exception 'Custom branding needs a paid tier — remove it or pick Small or larger';
    end if;
  end if;
  if (select count(*) from live_vote_options where event_id = e.id) < 2 then
    raise exception 'Add at least two options before going live';
  end if;
  if not adm then
    n_live := (select count(*) from live_vote_events
      where organizer_id = e.organizer_id and tier = 'free' and status = 'live');
    if n_live >= 1 then raise exception 'You already have a Free event live — close it or upgrade this one to a paid tier'; end if;
    n_recent := (select count(*) from live_vote_events
      where organizer_id = e.organizer_id and tier = 'free' and starts_at > now() - interval '30 days');
    if n_recent >= 5 then raise exception 'Free events are limited to 5 every 30 days — pick a paid tier for this one'; end if;
  end if;

  update live_vote_events
     set status = 'live', starts_at = now(), closes_at = now() + interval '24 hours',
         stripe_checkout_session_id = 'free', ads_enabled = true
   where id = e.id and status = 'draft';
end
$fn$;

-- ---------------------------------------------------------------------------
-- 2) Reopen locked or closed items (admins only)
-- ---------------------------------------------------------------------------

-- Bouts: a final bout goes back to live; a live bout that has passed its close
-- time (locked, waiting for the sweeper) gets a fresh close time.
create or replace function public.admin_reopen_bout(p_bout_id uuid, p_hours integer default 24)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b bouts;
  nxt bouts;
  hrs int := greatest(coalesce(p_hours, 24), 1);
begin
  if not coalesce(pred_is_admin(), false) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  perform 1 from bouts where id = p_bout_id for update;
  b := (select z from bouts z where z.id = p_bout_id);
  if b.id is null then raise exception 'Bout not found'; end if;
  if b.deleted_at is not null or b.archived_at is not null then
    raise exception 'Restore this bout from Trash or Archives first';
  end if;
  if b.status = 'upcoming' then raise exception 'This bout has not started yet'; end if;

  if b.status = 'live' then
    update bouts set closes_at = now() + make_interval(hours => hrs) where id = b.id;
    return;
  end if;

  -- final -> live
  if b.pooled_for_bracket then
    raise exception 'This bout was already pooled into an auto-bracket, so it cannot be reopened';
  end if;
  if b.next_bout_id is not null then
    nxt := (select z from bouts z where z.id = b.next_bout_id);
    if nxt.id is not null then
      if nxt.status = 'final'
         or (nxt.status = 'live' and exists (select 1 from votes where bout_id = nxt.id)) then
        raise exception 'The next round has already started, so this bout is locked in';
      end if;
      if b.next_slot = 'a' then
        update bouts set competitor_a_name = 'TBD', competitor_a_submission_id = null, seed_a = null where id = nxt.id;
      else
        update bouts set competitor_b_name = 'TBD', competitor_b_submission_id = null, seed_b = null where id = nxt.id;
      end if;
      -- the next round auto-started when this one closed; put it back to waiting
      if nxt.status = 'live' then
        update bouts
           set status = 'upcoming',
               closes_at = case when round_duration_minutes is not null then null else closes_at end
         where id = nxt.id;
      end if;
    end if;
  end if;

  -- take back the winner points so re-closing does not pay them twice
  update profiles p set points = greatest(p.points - e.s, 0)
    from (select user_id, sum(points) as s from point_events
           where reason = 'bout_win' and related_bout_id = b.id group by user_id) e
   where p.id = e.user_id;
  delete from point_events where reason = 'bout_win' and related_bout_id = b.id;

  update bouts set status = 'live', winner_side = null, closes_at = now() + make_interval(hours => hrs)
   where id = b.id;
end
$fn$;

-- Live Vote events: closed -> live
create or replace function public.admin_reopen_live_vote_event(p_event_id uuid, p_hours integer default 24, p_open_ended boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not coalesce(pred_is_admin(), false) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update live_vote_events
     set status = 'live',
         closes_at = case when p_open_ended then null else now() + make_interval(hours => greatest(coalesce(p_hours, 24), 1)) end
   where id = p_event_id and status = 'closed';
  if not found then raise exception 'Only a closed event can be reopened'; end if;
end
$fn$;

-- Showcases: closed -> live (the winner is decided again when it closes)
create or replace function public.admin_reopen_showcase(p_showcase_id uuid, p_hours integer default 24)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not coalesce(pred_is_admin(), false) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update showcases
     set status = 'live', closed_at = null, winner_choice_id = null,
         closes_at = now() + make_interval(hours => greatest(coalesce(p_hours, 24), 1))
   where id = p_showcase_id and status = 'closed';
  if not found then raise exception 'Only a closed showcase can be reopened'; end if;
end
$fn$;

-- Prediction games: a locked game (already started) or a graded final game
-- goes back to open. Predictions are reopened for p_minutes from now; a final
-- game loses its score and everyone's grade, and is graded again when the
-- score is re-entered. Bracket-round games: correct the score instead.
create or replace function public.admin_reopen_pred_game(p_game uuid, p_minutes integer default 60)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  g pred_games;
  mins int := greatest(coalesce(p_minutes, 60), 1);
begin
  if not coalesce(pred_is_admin(), false) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  perform 1 from pred_games where id = p_game for update;
  g := (select z from pred_games z where z.id = p_game);
  if g.id is null then raise exception 'Game not found'; end if;
  if g.round is not null and g.status = 'final' then
    raise exception 'Bracket games cannot be reopened after a final score. Correct the score instead.';
  end if;

  if g.status = 'final' then
    update pred_predictions
       set pts_entry = null, pts_winner = null, pts_exact = null, pts_close = null, pts_total = null, graded_at = null
     where game_id = g.id;
  end if;

  update pred_games
     set status = 'scheduled', home_score = null, away_score = null,
         finalized_at = null, finalized_by = null, winner_team_id = null,
         starts_at = now() + make_interval(mins => mins),
         reminder_count = 0, last_reminder_at = null
   where id = g.id;
end
$fn$;

revoke all on function public.admin_reopen_bout(uuid, integer) from public, anon;
revoke all on function public.admin_reopen_live_vote_event(uuid, integer, boolean) from public, anon;
revoke all on function public.admin_reopen_showcase(uuid, integer) from public, anon;
revoke all on function public.admin_reopen_pred_game(uuid, integer) from public, anon;
grant execute on function public.admin_reopen_bout(uuid, integer) to authenticated;
grant execute on function public.admin_reopen_live_vote_event(uuid, integer, boolean) to authenticated;
grant execute on function public.admin_reopen_showcase(uuid, integer) to authenticated;
grant execute on function public.admin_reopen_pred_game(uuid, integer) to authenticated;
