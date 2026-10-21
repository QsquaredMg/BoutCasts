-- Civics unit, part B: voter registration and candidate campaign pages.
-- Run after election_unit_a.sql. Safe to run more than once.

alter table public.school_elections
  add column if not exists require_registration boolean not null default false,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists campaign_page_enabled boolean not null default false;

alter table public.election_voters
  add column if not exists registered_at timestamptz,
  add column if not exists registered_via text;

alter table public.election_voters drop constraint if exists election_voters_registered_via_chk;
alter table public.election_voters add constraint election_voters_registered_via_chk
  check (registered_via is null or registered_via in ('self', 'desk'));

-- One profile per candidate: a slogan and up to three platform points. Read and written only by the server.
create table if not exists public.election_candidate_profiles (
  option_id uuid primary key references public.live_vote_options(id) on delete cascade,
  election_id uuid not null references public.school_elections(id) on delete cascade,
  slogan text check (slogan is null or char_length(slogan) <= 100),
  platform text[] not null default '{}' check (cardinality(platform) <= 3),
  updated_at timestamptz not null default now()
);
create index if not exists election_candidate_profiles_election_idx on public.election_candidate_profiles (election_id);
alter table public.election_candidate_profiles enable row level security;

-- A student registers themselves by name before the deadline. The answer never says whether the name was
-- on the roster, so the page cannot be used to guess who is enrolled.
create or replace function public.register_election_voter(p_election_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare el school_elections; n int;
begin
  select * into el from school_elections where id = p_election_id;
  if not found or el.status = 'closed' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if not el.require_registration then return jsonb_build_object('ok', false, 'error', 'not_required'); end if;
  if el.registration_closes_at is not null and el.registration_closes_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'deadline_passed');
  end if;
  update election_voters
     set registered_at = coalesce(registered_at, now()), registered_via = coalesce(registered_via, 'self')
   where election_id = p_election_id and name_norm = election_norm_name(p_name);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true);
end $fn$;

-- A teacher registers a student at the booth desk. Allowed after the deadline (a late or provisional registration).
create or replace function public.desk_register_voter(p_election_id uuid, p_voter_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare n int;
begin
  update election_voters
     set registered_at = coalesce(registered_at, now()), registered_via = coalesce(registered_via, 'desk')
   where id = p_voter_id and election_id = p_election_id;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $fn$;

-- Kiosk check-in and ballot casting now refuse unregistered voters when registration is required.
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
  if el.require_registration and v.registered_at is null then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;
  if v.voted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_voted');
  end if;

  update election_kiosks set failed_attempts = 0, locked_until = null where id = k.id;
  return jsonb_build_object('ok', true, 'voter_name', v.name, 'election_title', el.title,
                            'school_name', el.school_name, 'ballot', election_ballot(el.id));
end $fn$;

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
  if el.require_registration and v.registered_at is null and v.voted_at is null then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
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


revoke all on function public.register_election_voter(uuid, text) from public, anon, authenticated;
revoke all on function public.desk_register_voter(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_election_voter(uuid, text) to service_role;
grant execute on function public.desk_register_voter(uuid, uuid) to service_role;
revoke all on function public.kiosk_verify(text, text, text) from public, anon, authenticated;
revoke all on function public.kiosk_cast_ballot(text, text, text, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.kiosk_verify(text, text, text) to service_role;
grant execute on function public.kiosk_cast_ballot(text, text, text, jsonb, text, timestamptz) to service_role;
