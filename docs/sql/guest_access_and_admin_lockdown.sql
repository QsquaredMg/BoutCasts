-- Guest predictions + one-vote-per-network rules + admin lockdown.
-- Run in the Supabase SQL editor. Safe to run more than once.

-- 1) Helper: a hash of the caller's network address (never the address itself).
create or replace function public.guest_ip_hash()
returns text language plpgsql stable set search_path = public as $fn$
declare v_headers json; v_ip text;
begin
  begin v_headers := current_setting('request.headers', true)::json; exception when others then v_headers := null; end;
  v_ip := coalesce(
    nullif(trim(v_headers->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), ''),
    nullif(trim(v_headers->>'x-real-ip'), '')
  );
  if v_ip is null then return null; end if;
  return md5('bc-guest:' || v_ip);
end $fn$;

-- 2) Guest predictions (held until the guest makes an account, then moved onto it).
create table if not exists public.pred_guest_predictions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.pred_games(id) on delete cascade,
  token_hash text not null,
  ip_hash text,
  email text not null,
  name text not null,
  pick text not null,
  pred_home integer not null,
  pred_away integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, token_hash)
);
create unique index if not exists pred_guest_one_per_ip on public.pred_guest_predictions (game_id, ip_hash) where ip_hash is not null;
create unique index if not exists pred_guest_one_per_email on public.pred_guest_predictions (game_id, email);
alter table public.pred_guest_predictions enable row level security;
revoke all on public.pred_guest_predictions from anon, authenticated;

create or replace function public.get_guest_prediction(p_game uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare h text; gp record; pr record;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('registered', false); end if;
  h := md5(p_token);
  select * into gp from guest_profiles where token_hash = h;
  select * into pr from pred_guest_predictions where game_id = p_game and token_hash = h;
  return jsonb_build_object('registered', gp.token_hash is not null, 'name', gp.name,
    'pred_home', pr.pred_home, 'pred_away', pr.pred_away);
end $fn$;

create or replace function public.submit_guest_prediction(p_game uuid, p_home integer, p_away integer, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare g pred_games; h text; gp record; pk text; v_ip text;
begin
  if auth.uid() is not null then raise exception 'signed_in: You are signed in, so your pick counts on your account.'; end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 100 then raise exception 'Invalid guest token'; end if;
  h := md5(p_token);
  select * into gp from guest_profiles where token_hash = h;
  if gp.token_hash is null then raise exception 'guest_profile: Add your name and email to make a pick.'; end if;

  select * into g from pred_games where id = p_game;
  if not found then raise exception 'Game not found'; end if;
  if g.is_private then raise exception 'sign_in: Private games need a free account.'; end if;
  if g.round is not null then raise exception 'sign_in: Brackets need a free account.'; end if;
  if g.slate_id is not null and not pred_slate_is_open(g.slate_id) then raise exception 'This bracket is closed to new predictions'; end if;
  if g.status <> 'scheduled' then raise exception 'This game is closed'; end if;
  if now() >= g.starts_at + pred_lock_grace() then raise exception 'Predictions closed 15 minutes after the game started'; end if;
  if p_home is null or p_away is null or p_home < 0 or p_away < 0 or p_home > 999 or p_away > 999 then raise exception 'Enter valid scores'; end if;
  if p_home = p_away then
    if not g.allow_draw then raise exception 'This game cannot end in a tie, so pick a winner'; end if;
    pk := 'draw';
  elsif p_home > p_away then pk := 'home'; else pk := 'away'; end if;

  v_ip := guest_ip_hash();
  if v_ip is not null and exists (select 1 from pred_guest_predictions where game_id = p_game and ip_hash = v_ip and token_hash <> h) then
    raise exception 'guest_limit: Someone on this network already made a pick for this game. Create a free account to add yours.';
  end if;
  if exists (select 1 from pred_guest_predictions where game_id = p_game and email = gp.email and token_hash <> h) then
    raise exception 'guest_limit: That email already has a pick for this game.';
  end if;

  insert into pred_guest_predictions (game_id, token_hash, ip_hash, email, name, pick, pred_home, pred_away)
  values (p_game, h, v_ip, gp.email, gp.name, pk, p_home, p_away)
  on conflict (game_id, token_hash) do update
    set pick = excluded.pick, pred_home = excluded.pred_home, pred_away = excluded.pred_away, updated_at = now();
  return jsonb_build_object('ok', true);
exception when unique_violation then
  raise exception 'guest_limit: Someone on this network or email already made a pick for this game.';
end $fn$;

grant execute on function public.get_guest_prediction(uuid, text) to anon, authenticated;
grant execute on function public.submit_guest_prediction(uuid, integer, integer, text) to anon, authenticated;

-- 3) When a guest signs in, their open picks move onto the account too.
create or replace function public.claim_guest_activity(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare h text; moved int := 0; moved_preds int := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('moved', 0); end if;
  h := md5(p_token);
  update guest_profiles set claimed_user_id = auth.uid(), claimed_at = now() where token_hash = h and claimed_user_id is null;
  update votes v set user_id = auth.uid(), guest_token_hash = null, guest_ip_hash = null
   where v.guest_token_hash = h
     and not exists (select 1 from votes x where x.bout_id = v.bout_id and x.user_id = auth.uid());
  get diagnostics moved = row_count;

  insert into pred_predictions (game_id, user_id, pick, pred_home, pred_away)
  select gp.game_id, auth.uid(), gp.pick, gp.pred_home, gp.pred_away
    from pred_guest_predictions gp join pred_games pg on pg.id = gp.game_id
   where gp.token_hash = h and pg.status = 'scheduled' and now() < pg.starts_at + pred_lock_grace()
  on conflict (game_id, user_id) do nothing;
  get diagnostics moved_preds = row_count;
  delete from pred_guest_predictions where token_hash = h;

  return jsonb_build_object('moved', moved, 'moved_predictions', moved_preds);
end $fn$;

-- 4) One guest vote per network and per email on each bout.
create or replace function public.cast_guest_bout_vote(p_bout_id uuid, p_side text, p_guest_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_day date := guest_vote_day(); v_hash text; v_ip_hash text; v_ip_count int; v_used int; v_email text;
begin
  if auth.uid() is not null then raise exception 'signed_in: You are signed in — your vote counts on your account.'; end if;
  if p_side not in ('a', 'b') then raise exception 'Invalid side'; end if;
  if p_guest_token is null or length(p_guest_token) < 20 or length(p_guest_token) > 100 then raise exception 'Invalid guest token'; end if;
  v_hash := md5(p_guest_token);

  select email into v_email from guest_profiles where token_hash = v_hash;
  if v_email is null then
    raise exception 'guest_profile: Add your name and email to vote.';
  end if;

  if not exists (
    select 1 from bouts b
     where b.id = p_bout_id and b.status <> 'final'
       and (b.closes_at is null or now() < b.closes_at)
       and bout_is_matched(b.competitor_a_name, b.competitor_b_name)
  ) then raise exception 'closed: Voting is closed for this bout.'; end if;

  if exists (select 1 from votes where bout_id = p_bout_id and guest_token_hash = v_hash) then
    raise exception 'already: You already voted on this bout.';
  end if;

  v_used := (select count(*) from votes where guest_token_hash = v_hash and vote_day = v_day);
  if v_used >= guest_daily_limit() then
    raise exception 'guest_limit: You''ve used your % free votes for today. Create an account to keep voting.', guest_daily_limit();
  end if;

  v_ip_hash := guest_ip_hash();
  if v_ip_hash is not null then
    if exists (select 1 from votes where bout_id = p_bout_id and guest_ip_hash = v_ip_hash) then
      raise exception 'guest_limit: Someone on this network already voted on this bout. Create a free account to vote from here.';
    end if;
    v_ip_count := (select count(*) from votes where guest_ip_hash = v_ip_hash and vote_day = v_day);
    if v_ip_count >= 150 then raise exception 'guest_limit: Free votes from this network are used up for today.'; end if;
  end if;
  if exists (
    select 1 from votes v join guest_profiles gp on gp.token_hash = v.guest_token_hash
     where v.bout_id = p_bout_id and gp.email = v_email
  ) then
    raise exception 'guest_limit: That email has already voted on this bout.';
  end if;

  insert into votes (bout_id, user_id, side, guest_token_hash, guest_ip_hash, vote_day)
  values (p_bout_id, null, p_side, v_hash, v_ip_hash, v_day);

  return jsonb_build_object('ok', true, 'used_today', v_used + 1, 'limit', guest_daily_limit(), 'resets_at', guest_vote_resets_at());
exception when unique_violation then
  raise exception 'already: You already voted on this bout.';
end $fn$;

-- 5) One guest vote per network on each debate and showcase.
create or replace function public.cast_debate_vote(p_match_id uuid, p_side text, p_guest_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare m record; t record; v_uid uuid := auth.uid(); v_day date := guest_vote_day(); v_hash text; v_ip_hash text; n int;
begin
  select * into m from debate_matches where id = p_match_id;
  if m.id is null or m.status <> 'voting' or m.voting_closes_at < now() then raise exception 'closed: Voting isn''t open for this debate'; end if;
  select * into t from debate_topics where id = m.topic_id;
  if t.scoring_mode = 'judges' then raise exception 'closed: This debate is decided by judges'; end if;
  if p_side not in ('for', 'against') then raise exception 'Pick a side'; end if;

  if v_uid is not null then
    if v_uid in (m.for_user_id, m.against_user_id) then raise exception 'You can''t vote in your own debate'; end if;
    begin
      insert into debate_votes (match_id, side, user_id) values (m.id, p_side, v_uid);
    exception when unique_violation then raise exception 'already: You already voted in this debate'; end;
  else
    if p_guest_token is null or length(p_guest_token) < 20 then raise exception 'Invalid guest token'; end if;
    v_hash := md5(p_guest_token);
    if exists (select 1 from debate_votes where guest_token_hash = v_hash and vote_day = v_day) then
      raise exception 'guest_limit: You''ve used your free debate vote for today.';
    end if;
    v_ip_hash := guest_ip_hash();
    if v_ip_hash is not null then
      if exists (select 1 from debate_votes where match_id = m.id and guest_ip_hash = v_ip_hash) then
        raise exception 'guest_limit: Someone on this network already voted in this debate. Create a free account to vote from here.';
      end if;
      select count(*) into n from debate_votes where guest_ip_hash = v_ip_hash and vote_day = v_day;
      if n >= 5 then raise exception 'guest_limit: Free votes from this network are used up for today.'; end if;
    end if;
    begin
      insert into debate_votes (match_id, side, guest_token_hash, guest_ip_hash, vote_day) values (m.id, p_side, v_hash, v_ip_hash, v_day);
    exception when unique_violation then raise exception 'guest_limit: You''ve used your free debate vote for today.'; end;
  end if;
  return jsonb_build_object('ok', true, 'resets_at', guest_vote_resets_at());
end $fn$;

create or replace function public.cast_showcase_vote(p_showcase_id uuid, p_choice_id uuid, p_guest_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare s record; v_uid uuid := auth.uid(); v_day date := guest_vote_day(); v_hash text; v_ip_hash text; n int;
begin
  select * into s from showcases where id = p_showcase_id;
  if s.id is null or s.status <> 'live' or (s.closes_at is not null and s.closes_at < now()) then
    raise exception 'closed: Voting is closed';
  end if;
  if s.scoring_mode = 'judges' then raise exception 'closed: This one is decided by judges'; end if;
  if not exists (select 1 from showcase_choices where id = p_choice_id and showcase_id = s.id) then raise exception 'Pick one of the choices'; end if;
  if v_uid is not null then
    if exists (select 1 from profiles where id = v_uid and is_suspended) then raise exception 'Your account can''t vote right now'; end if;
    begin
      insert into showcase_votes (showcase_id, choice_id, user_id) values (s.id, p_choice_id, v_uid);
    exception when unique_violation then raise exception 'already: You already voted here'; end;
  else
    if p_guest_token is null or length(p_guest_token) < 20 then raise exception 'Invalid guest token'; end if;
    v_hash := md5('sc:' || p_guest_token);
    if exists (select 1 from showcase_votes where guest_token_hash = v_hash and vote_day = v_day) then
      raise exception 'guest_limit: You''ve used your free showcase vote for today.';
    end if;
    v_ip_hash := guest_ip_hash();
    if v_ip_hash is not null then
      if exists (select 1 from showcase_votes where showcase_id = s.id and guest_ip_hash = v_ip_hash) then
        raise exception 'guest_limit: Someone on this network already voted here. Create a free account to vote from here.';
      end if;
      select count(*) into n from showcase_votes where guest_ip_hash = v_ip_hash and vote_day = v_day;
      if n >= 5 then raise exception 'guest_limit: Free votes from this network are used up for today.'; end if;
    end if;
    begin
      insert into showcase_votes (showcase_id, choice_id, guest_token_hash, guest_ip_hash, vote_day)
      values (s.id, p_choice_id, v_hash, v_ip_hash, v_day);
    exception when unique_violation then raise exception 'guest_limit: You''ve used your free showcase vote for today.'; end;
  end if;
  return jsonb_build_object('ok', true, 'resets_at', guest_vote_resets_at());
end $fn$;

-- 6) Admin lockdown: no admin function can be called by signed-out visitors.
--    (Each one also checks for an admin account inside; this closes the door earlier.)
do $do$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like 'admin\_%' or p.proname in (
            'bouts_mark_admin', 'bouts_enforce_max_window', 'set_live_vote_collect_email',
            'auto_finalize_pred_game', 'purge_old_trashed_bouts'))
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
  end loop;
end $do$;
-- Only the service key may auto-score games; signed-in users never need these.
revoke execute on function public.auto_finalize_pred_game(uuid, integer, integer) from authenticated;
