-- BoutCasts Guest Pass
-- Lets people vote from a shared link without an account. Guests give a name (and an
-- email on public bouts); they can then vote on up to guest_daily_limit() bouts a day.
-- Their votes are saved against the device and move onto their account when they sign up.
--
-- Safe to run more than once. Run this BEFORE deploying the matching app code: the
-- app falls back to the old one-vote-a-day behaviour if these functions are missing,
-- but the new vote card only appears once they exist.
--
-- Changes to existing objects:
--   * drops the unique index votes_guest_one_per_day (it allowed only 1 guest vote a day)
--   * adds votes_guest_one_per_bout (a guest still gets one vote per bout)
--   * replaces cast_guest_bout_vote: needs a guest profile, 15/day, 150/day per network
--   * adds live_vote_events.collect_voter_email (default false)

create or replace function public.guest_daily_limit() returns int
language sql immutable as $fn$ select 15 $fn$;

-- ---------------------------------------------------------------- bouts
create table if not exists public.guest_profiles (
  token_hash text primary key,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);
create index if not exists guest_profiles_email_idx on public.guest_profiles (lower(email));
alter table public.guest_profiles enable row level security;
drop policy if exists guest_profiles_admin_read on public.guest_profiles;
create policy guest_profiles_admin_read on public.guest_profiles for select to authenticated using (public.is_admin_user());

drop index if exists public.votes_guest_one_per_day;
create index if not exists votes_guest_day_idx on public.votes (guest_token_hash, vote_day) where guest_token_hash is not null;
create unique index if not exists votes_guest_one_per_bout on public.votes (bout_id, guest_token_hash) where guest_token_hash is not null;

create or replace function public.register_bout_guest(p_token text, p_name text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 100 then raise exception 'Invalid guest token'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 1 then raise exception 'name: Please enter your name.'; end if;
  if coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email: Please enter a valid email.'; end if;
  insert into guest_profiles (token_hash, name, email)
  values (md5(p_token), left(btrim(p_name), 40), lower(btrim(p_email)))
  on conflict (token_hash) do update set name = excluded.name, email = excluded.email;
  return jsonb_build_object('ok', true);
end $fn$;

create or replace function public.get_guest_status(p_token text, p_bout_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare h text; gname text; used int := 0; side_here text;
begin
  if p_token is null or length(p_token) < 20 then
    return jsonb_build_object('registered', false, 'used_today', 0, 'limit', guest_daily_limit(), 'resets_at', guest_vote_resets_at());
  end if;
  h := md5(p_token);
  gname := (select name from guest_profiles where token_hash = h);
  used := (select count(*) from votes where guest_token_hash = h and vote_day = guest_vote_day());
  if p_bout_id is not null then side_here := (select side from votes where bout_id = p_bout_id and guest_token_hash = h limit 1); end if;
  return jsonb_build_object('registered', gname is not null, 'name', gname, 'used_today', used,
    'limit', guest_daily_limit(), 'side_here', side_here, 'resets_at', guest_vote_resets_at());
end $fn$;

create or replace function public.cast_guest_bout_vote(p_bout_id uuid, p_side text, p_guest_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_day date := guest_vote_day(); v_hash text; v_ip text; v_ip_hash text; v_headers json; v_ip_count int; v_used int;
begin
  if auth.uid() is not null then raise exception 'signed_in: You are signed in — your vote counts on your account.'; end if;
  if p_side not in ('a', 'b') then raise exception 'Invalid side'; end if;
  if p_guest_token is null or length(p_guest_token) < 20 or length(p_guest_token) > 100 then raise exception 'Invalid guest token'; end if;
  v_hash := md5(p_guest_token);

  if not exists (select 1 from guest_profiles where token_hash = v_hash) then
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

  begin v_headers := current_setting('request.headers', true)::json; exception when others then v_headers := null; end;
  v_ip := coalesce(v_headers->>'cf-connecting-ip', split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), v_headers->>'x-real-ip');
  v_ip := nullif(trim(v_ip), '');
  if v_ip is not null then
    v_ip_hash := md5('bc-guest:' || v_ip);
    v_ip_count := (select count(*) from votes where guest_ip_hash = v_ip_hash and vote_day = v_day);
    if v_ip_count >= 150 then raise exception 'guest_limit: Free votes from this network are used up for today.'; end if;
  end if;

  insert into votes (bout_id, user_id, side, guest_token_hash, guest_ip_hash, vote_day)
  values (p_bout_id, null, p_side, v_hash, v_ip_hash, v_day);

  return jsonb_build_object('ok', true, 'used_today', v_used + 1, 'limit', guest_daily_limit(), 'resets_at', guest_vote_resets_at());
exception when unique_violation then
  raise exception 'already: You already voted on this bout.';
end $fn$;

-- Moves a device's guest votes onto the account that just signed up or signed in.
create or replace function public.claim_guest_activity(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare h text; moved int := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('moved', 0); end if;
  h := md5(p_token);
  update guest_profiles set claimed_user_id = auth.uid(), claimed_at = now() where token_hash = h and claimed_user_id is null;
  update votes v set user_id = auth.uid(), guest_token_hash = null, guest_ip_hash = null
   where v.guest_token_hash = h
     and not exists (select 1 from votes x where x.bout_id = v.bout_id and x.user_id = auth.uid());
  get diagnostics moved = row_count;
  return jsonb_build_object('moved', moved);
end $fn$;

-- ---------------------------------------------------------------- Live Vote
alter table public.live_vote_events add column if not exists collect_voter_email boolean not null default false;

create table if not exists public.live_vote_guests (
  event_id uuid not null references public.live_vote_events(id) on delete cascade,
  voter_token uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  created_at timestamptz not null default now(),
  primary key (event_id, voter_token)
);
alter table public.live_vote_guests enable row level security;
-- No direct policies: guests and organizers go through the functions below.

-- What the ballot should ask for. Private events ask for a name; organizers can add email.
create or replace function public.get_live_vote_guest_config(p_event_id uuid, p_token uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v_private boolean; v_collect boolean; v_mode text; gname text;
begin
  if not exists (select 1 from live_vote_events where id = p_event_id) then return null; end if;
  v_private := (select is_private from live_vote_events where id = p_event_id);
  v_collect := (select collect_voter_email from live_vote_events where id = p_event_id);
  v_mode := (select voter_mode from live_vote_events where id = p_event_id);
  if p_token is not null then gname := (select name from live_vote_guests where event_id = p_event_id and voter_token = p_token limit 1); end if;
  return jsonb_build_object(
    'needs_name', (v_mode = 'open_link' and (v_private or v_collect)),
    'needs_email', (v_mode = 'open_link' and v_collect),
    'registered', gname is not null, 'name', gname);
end $fn$;

create or replace function public.register_live_vote_guest(p_event_id uuid, p_token uuid, p_name text, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_status text; v_collect boolean; em text;
begin
  if not exists (select 1 from live_vote_events where id = p_event_id) then raise exception 'closed: This event is closed.'; end if;
  v_status := (select status from live_vote_events where id = p_event_id);
  v_collect := (select collect_voter_email from live_vote_events where id = p_event_id);
  if v_status = 'closed' then raise exception 'closed: This event is closed.'; end if;
  if p_token is null then raise exception 'Invalid token'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 1 then raise exception 'name: Please enter your name.'; end if;
  if v_collect then
    if coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email: Please enter a valid email.'; end if;
    em := lower(btrim(p_email));
  end if;
  insert into live_vote_guests (event_id, voter_token, name, email) values (p_event_id, p_token, left(btrim(p_name), 40), em)
  on conflict (event_id, voter_token) do update set name = excluded.name, email = excluded.email;
  return jsonb_build_object('ok', true);
end $fn$;

-- Organizer-only roster. It deliberately has no token, so names are never tied to ballots.
create or replace function public.live_vote_participants(p_event_id uuid)
returns table(name text, email text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not live_vote_can_manage(p_event_id) then raise exception 'Only the organizer can see this'; end if;
  return query select g.name, g.email, g.created_at from live_vote_guests g where g.event_id = p_event_id order by g.created_at;
end $fn$;

create or replace function public.set_live_vote_collect_email(p_event_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update live_vote_events set collect_voter_email = p_on where id = p_event_id and organizer_id = auth.uid() and status <> 'closed';
  if not found then raise exception 'Only the organizer can change this before voting closes'; end if;
end $fn$;

grant execute on function public.register_bout_guest(text, text, text) to anon, authenticated;
grant execute on function public.get_guest_status(text, uuid) to anon, authenticated;
grant execute on function public.cast_guest_bout_vote(uuid, text, text) to anon, authenticated;
grant execute on function public.claim_guest_activity(text) to authenticated;
grant execute on function public.get_live_vote_guest_config(uuid, uuid) to anon, authenticated;
grant execute on function public.register_live_vote_guest(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.live_vote_participants(uuid) to authenticated;
grant execute on function public.set_live_vote_collect_email(uuid, boolean) to authenticated;
