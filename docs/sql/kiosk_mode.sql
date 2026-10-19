-- BoutCasts School Election Kiosk Mode.
-- A school election holds several races (offices) that share one roster, one close time and up to
-- three kiosks (iPads). Students check in at a booth: a teacher hands out a code, the student types
-- the code and their name, votes every office on one ballot, and the code is spent.
--
-- Safe to run more than once. Run AFTER docs/sql/pricing_75_platinum_addon.sql and BEFORE deploying
-- the matching app code.
--
-- Design notes
--   * Each race is a normal live_vote_events row (election_id set, private, never listed), so the
--     existing vote caps, options and tally code are reused.
--   * Secret ballot: election_voters records WHO voted (voted_at, kiosk). live_votes rows written by a
--     kiosk carry a fresh random voter_token, so a ballot can never be tied back to a student.
--   * Results stay hidden until the election closes: get_live_vote_tally returns no rows for election
--     races while voting is open, for everyone, organizer included.
--   * All new tables have RLS on and NO policies: only the service role (the app's API routes) and the
--     SECURITY DEFINER functions below can touch them.
--   * Codes are stored in plain text on purpose: the teacher at the booth has to read them out.
--     They are random, single-use and election-scoped, and the roster should be deleted after the vote.

create table if not exists public.school_elections (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  school_name text check (school_name is null or char_length(school_name) <= 120),
  tier text not null check (tier in ('free','small','medium','large')),
  kiosks integer not null default 1 check (kiosks between 1 and 3),
  days integer not null default 1 check (days between 1 and 3),
  price_cents integer not null check (price_cents >= 0),
  exit_pin_hash text not null,
  status text not null default 'draft' check (status in ('draft','live','closed')),
  starts_at timestamptz,
  closes_at timestamptz,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);
create index if not exists school_elections_organizer_idx on public.school_elections (organizer_id, created_at desc);
alter table public.school_elections enable row level security;

-- Look and feel chosen at setup, applied to every page of the election (organizer, booth desk, kiosk, winners graphic).
alter table public.school_elections
  add column if not exists brand_logo_url text,
  add column if not exists cover_image_url text,
  add column if not exists brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists brand_bg_color text check (brand_bg_color is null or brand_bg_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists brand_bg_image_url text,
  add column if not exists show_tally boolean not null default true,
  add column if not exists open_ended boolean not null default false; -- admin only: no end time, closed by hand

alter table public.live_vote_events
  add column if not exists election_id uuid references public.school_elections(id) on delete cascade,
  add column if not exists election_sort integer not null default 0;
create index if not exists live_vote_events_election_idx on public.live_vote_events (election_id) where election_id is not null;

create table if not exists public.election_voters (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  name_norm text not null,
  student_ref text check (student_ref is null or char_length(student_ref) <= 60),
  code text not null,
  voted_at timestamptz,
  voted_kiosk uuid,
  voted_request_id text,
  created_at timestamptz not null default now(),
  unique (election_id, code)
);
create index if not exists election_voters_name_idx on public.election_voters (election_id, name_norm);
alter table public.election_voters enable row level security;

create table if not exists public.election_kiosks (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  label text not null default 'Kiosk',
  token_hash text not null unique,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.election_kiosks enable row level security;

-- Audit trail: when and where, never the choices.
create table if not exists public.election_audit (
  id bigint generated always as identity primary key,
  election_id uuid not null references public.school_elections(id) on delete cascade,
  kiosk_id uuid,
  kind text not null,
  created_at timestamptz not null default now()
);
alter table public.election_audit enable row level security;

-- Optional staff seats: a teacher can use the booth desk with a code instead of the organizer's login.
create table if not exists public.election_staff (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.school_elections(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.election_staff enable row level security;

-- ---------------------------------------------------------------- results hidden until close
create or replace function public.get_live_vote_tally(p_event_id uuid)
returns table(option_id uuid, votes bigint)
language sql stable security definer set search_path to 'public' as $fn$
  select o.id as option_id,
         (select count(*) from live_votes v where v.option_id = o.id and v.event_id = p_event_id)
         + case when e.super_votes_enabled and e.super_votes_mode = 'counted'
                then coalesce((select sum(s.quantity) from live_vote_super_votes s where s.option_id = o.id), 0)
                else 0 end
  from live_vote_options o join live_vote_events e on e.id = o.event_id
  where o.event_id = p_event_id
    and (e.election_id is null
         or e.status = 'closed'
         or (e.closes_at is not null and e.closes_at <= now()));
$fn$;

-- ---------------------------------------------------------------- helpers
create or replace function public.election_norm_name(p text)
returns text language sql immutable as $fn$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'));
$fn$;

create or replace function public.election_ballot(p_election_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'race_id', e.id,
           'title', e.title,
           'options', coalesce((select jsonb_agg(jsonb_build_object(
                'id', o.id, 'name', o.name, 'description', o.description, 'image_url', o.image_url,
                'video_url', case when o.source_type in ('upload','record') then o.source_url else null end,
                'media_seconds', o.media_seconds)
                order by o.sort_order, o.created_at)
              from live_vote_options o where o.event_id = e.id), '[]'::jsonb))
         order by e.election_sort, e.created_at), '[]'::jsonb)
  from live_vote_events e where e.election_id = p_election_id;
$fn$;

-- ---------------------------------------------------------------- kiosk: check a code + name
create or replace function public.kiosk_verify(p_token_hash text, p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare k election_kiosks; el school_elections; v election_voters; attempts int;
begin
  select * into k from election_kiosks where token_hash = p_token_hash;
  if not found then return jsonb_build_object('ok', false, 'error', 'kiosk_unknown'); end if;
  select * into el from school_elections where id = k.election_id;
  if el.status <> 'live' or (el.closes_at is not null and el.closes_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if k.locked_until is not null and k.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select * into v from election_voters
   where election_id = el.id and code = upper(btrim(coalesce(p_code, '')));
  if not found or v.name_norm <> election_norm_name(p_name) then
    attempts := k.failed_attempts + 1;
    update election_kiosks
       set failed_attempts = attempts,
           locked_until = case when attempts >= 5 then now() + interval '5 minutes' else locked_until end
     where id = k.id;
    insert into election_audit (election_id, kiosk_id, kind) values (el.id, k.id, case when attempts >= 5 then 'locked' else 'no_match' end);
    return jsonb_build_object('ok', false, 'error', case when attempts >= 5 then 'locked' else 'no_match' end);
  end if;
  if v.voted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_voted');
  end if;

  update election_kiosks set failed_attempts = 0, locked_until = null where id = k.id;
  return jsonb_build_object('ok', true, 'voter_name', v.name, 'election_title', el.title,
                            'school_name', el.school_name, 'ballot', election_ballot(el.id));
end $fn$;

-- ---------------------------------------------------------------- kiosk: cast the whole ballot
-- p_choices is {"<race_id>": "<option_id>" | null}. Null or missing means the student skipped that office.
-- p_cast_at is when the student pressed submit on the iPad. A ballot saved offline can arrive after voting
-- closed and still counts if it was cast while voting was open and arrives within 6 hours of the close.
drop function if exists public.kiosk_cast_ballot(text, text, text, jsonb, text);
create or replace function public.kiosk_cast_ballot(p_token_hash text, p_code text, p_name text, p_choices jsonb, p_request_id text, p_cast_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare k election_kiosks; el school_elections; v election_voters; r record; pick text; v_at timestamptz;
begin
  select * into k from election_kiosks where token_hash = p_token_hash;
  if not found then return jsonb_build_object('ok', false, 'error', 'kiosk_unknown'); end if;
  select * into el from school_elections where id = k.election_id;
  v_at := least(coalesce(p_cast_at, now()), now());
  if el.status = 'draft' or el.starts_at is null
     or v_at < el.starts_at - interval '1 minute'
     or (el.closes_at is not null and (v_at > el.closes_at or now() > el.closes_at + interval '6 hours')) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if k.locked_until is not null and k.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select * into v from election_voters
   where election_id = el.id and code = upper(btrim(coalesce(p_code, '')))
   for update;
  if not found or v.name_norm <> election_norm_name(p_name) then
    -- Wrong guesses here count toward the same lockout as the check-in screen.
    update election_kiosks
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else locked_until end
     where id = k.id;
    insert into election_audit (election_id, kiosk_id, kind) values (el.id, k.id, 'no_match');
    return jsonb_build_object('ok', false, 'error', 'no_match');
  end if;
  if v.voted_at is not null then
    -- A retry of the same submission (the network dropped after the first one landed) is a success.
    if p_request_id is not null and v.voted_request_id = p_request_id then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_voted');
  end if;

  for r in select id from live_vote_events where election_id = el.id order by election_sort, created_at loop
    pick := nullif(p_choices ->> r.id::text, '');
    if pick is not null then
      if not exists (select 1 from live_vote_options o where o.id = pick::uuid and o.event_id = r.id) then
        raise exception 'Invalid choice for this office';
      end if;
      insert into live_votes (event_id, option_id, voter_token) values (r.id, pick::uuid, gen_random_uuid());
    end if;
  end loop;

  update election_voters set voted_at = v_at, voted_kiosk = k.id, voted_request_id = p_request_id where id = v.id;
  insert into election_audit (election_id, kiosk_id, kind) values (el.id, k.id, case when p_cast_at is not null and p_cast_at < now() - interval '1 minute' then 'ballot_late' else 'ballot' end);
  return jsonb_build_object('ok', true);
end $fn$;

-- ---------------------------------------------------------------- kiosk: teacher unlock (PIN checked by the app)
create or replace function public.kiosk_unlock(p_token_hash text)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare k election_kiosks;
begin
  select * into k from election_kiosks where token_hash = p_token_hash;
  if not found then return; end if;
  update election_kiosks set failed_attempts = 0, locked_until = null where id = k.id;
  insert into election_audit (election_id, kiosk_id, kind) values (k.election_id, k.id, 'unlock');
end $fn$;

-- ---------------------------------------------------------------- go live after payment
create or replace function public.apply_school_election_payment(p_election_id uuid, p_session_id text)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare el school_elections; v_start timestamptz := now(); v_close timestamptz;
begin
  select * into el from school_elections where id = p_election_id for update;
  if not found or el.status <> 'draft' then return; end if; -- repeated webhook delivery is a no-op
  -- A Free election keeps the Free window (12 hours) when it runs a single day.
  -- Open-ended (admin) elections have no end time and run until someone closes them.
  v_close := case when el.open_ended then null
                  else v_start + case when el.tier = 'free' and el.days = 1 then interval '12 hours' else make_interval(days => el.days) end end;
  update school_elections
     set status = 'live', starts_at = v_start, closes_at = v_close, stripe_checkout_session_id = p_session_id
   where id = el.id;
  update live_vote_events
     set status = 'live', starts_at = v_start, closes_at = v_close, stripe_checkout_session_id = 'election'
   where election_id = el.id and status = 'draft';
end $fn$;

-- Close an election early (organizer, via the app's API).
create or replace function public.close_school_election(p_election_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  update school_elections set status = 'closed', closes_at = least(coalesce(closes_at, now()), now()) where id = p_election_id and status <> 'closed';
  update live_vote_events set status = 'closed', closes_at = least(coalesce(closes_at, now()), now()) where election_id = p_election_id and status <> 'closed';
end $fn$;

-- Only the service role (the app's server) may call these.
revoke all on function public.kiosk_verify(text, text, text) from public, anon, authenticated;
revoke all on function public.kiosk_cast_ballot(text, text, text, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.kiosk_unlock(text) from public, anon, authenticated;
revoke all on function public.apply_school_election_payment(uuid, text) from public, anon, authenticated;
revoke all on function public.close_school_election(uuid) from public, anon, authenticated;
revoke all on function public.election_ballot(uuid) from public, anon, authenticated;
grant execute on function public.kiosk_verify(text, text, text) to service_role;
grant execute on function public.kiosk_cast_ballot(text, text, text, jsonb, text, timestamptz) to service_role;
grant execute on function public.kiosk_unlock(text) to service_role;
grant execute on function public.apply_school_election_payment(uuid, text) to service_role;
grant execute on function public.close_school_election(uuid) to service_role;
grant execute on function public.election_ballot(uuid) to service_role;

-- ---------------------------------------------------------------- keep kiosk votes out of the live feed
-- Every vote is copied to live_vote_tally_feed, which the organizer and anyone holding a race id can read in
-- real time. Kiosk races must stay hidden until the election closes, so they are left out of the feed.
create or replace function public.live_votes_to_feed()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if exists (select 1 from live_vote_events e where e.id = new.event_id and e.election_id is not null) then
    return new;
  end if;
  insert into live_vote_tally_feed(event_id, option_id) values (new.event_id, new.option_id);
  return new;
end $fn$;
