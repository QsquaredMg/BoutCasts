-- BoutCasts School Election: vote by link (alongside kiosks).
-- One shared link for the whole school. Each rostered student types their own code and name, then votes
-- office by office; each office can be voted once, and the student can come back until voting closes.
-- Safe to run more than once. Run AFTER kiosk_mode.sql, election_unit_a/b/c.sql and kiosk_open_ended.sql.
--
--   * Secret ballot is unchanged: election_voter_votes records WHO voted in WHICH office, never the choice.
--     live_votes rows get a fresh random voter_token, exactly like kiosk ballots.
--   * Results stay hidden until close (get_live_vote_tally already hides election races).
--   * A student who voted at a kiosk cannot vote by link, and a student who started by link is
--     marked voted_at, so a kiosk check-in refuses them. Nobody votes an office twice.
--   * All new tables: RLS on, no policies. Functions are callable by the service role only.

alter table public.school_elections add column if not exists link_voting boolean not null default false;
alter table public.election_voters
  add column if not exists email text check (email is null or char_length(email) <= 200),
  add column if not exists emailed_at timestamptz;

create table if not exists public.election_voter_votes (
  voter_id uuid not null references public.election_voters(id) on delete cascade,
  race_id uuid not null references public.live_vote_events(id) on delete cascade,
  election_id uuid not null references public.school_elections(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (voter_id, race_id)
);
create index if not exists election_voter_votes_election_idx on public.election_voter_votes (election_id);
alter table public.election_voter_votes enable row level security;

create table if not exists public.election_link_attempts (
  election_id uuid not null references public.school_elections(id) on delete cascade,
  ip_hash text not null,
  failed integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (election_id, ip_hash)
);
alter table public.election_link_attempts enable row level security;

-- Shared check for both entry points. Returns an error code, or null and the voter row.
create or replace function public._link_vote_auth(p_election_id uuid, p_code text, p_name text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare el school_elections; v election_voters; a election_link_attempts; ip text := coalesce(nullif(p_ip_hash, ''), 'unknown');
begin
  select * into el from school_elections where id = p_election_id;
  if not found or not el.link_voting then return jsonb_build_object('error', 'not_available'); end if;
  if el.status <> 'live' or (el.closes_at is not null and el.closes_at <= now()) then
    return jsonb_build_object('error', case when el.status = 'draft' then 'not_open' else 'closed' end);
  end if;

  select * into a from election_link_attempts where election_id = el.id and ip_hash = ip;
  if found and a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('error', 'locked');
  end if;

  select * into v from election_voters
   where election_id = el.id and code = upper(btrim(coalesce(p_code, '')));
  if not found or v.name_norm <> election_norm_name(p_name) then
    insert into election_link_attempts (election_id, ip_hash, failed, locked_until, updated_at)
    values (el.id, ip, 1, null, now())
    on conflict (election_id, ip_hash) do update
      set failed = case when election_link_attempts.locked_until is not null and election_link_attempts.locked_until <= now() then 1 else election_link_attempts.failed + 1 end,
          locked_until = case when (case when election_link_attempts.locked_until is not null and election_link_attempts.locked_until <= now() then 1 else election_link_attempts.failed + 1 end) >= 8
                              then now() + interval '10 minutes' else null end,
          updated_at = now();
    return jsonb_build_object('error', 'no_match');
  end if;
  if el.require_registration and v.registered_at is null then
    return jsonb_build_object('error', 'not_registered');
  end if;
  if v.voted_kiosk is not null then
    return jsonb_build_object('error', 'voted_at_kiosk');
  end if;
  delete from election_link_attempts where election_id = el.id and ip_hash = ip;
  return jsonb_build_object('error', null, 'voter_id', v.id);
end $fn$;

-- Sign in: returns the ballot and which offices this student has already voted.
create or replace function public.link_vote_open(p_election_id uuid, p_code text, p_name text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare r jsonb; el school_elections; v election_voters;
begin
  r := _link_vote_auth(p_election_id, p_code, p_name, p_ip_hash);
  if r ->> 'error' is not null then return jsonb_build_object('ok', false, 'error', r ->> 'error'); end if;
  select * into el from school_elections where id = p_election_id;
  select * into v from election_voters where id = (r ->> 'voter_id')::uuid;
  return jsonb_build_object('ok', true, 'voter_name', v.name, 'election_title', el.title, 'school_name', el.school_name,
    'closes_at', el.closes_at,
    'ballot', election_ballot(el.id),
    'voted', coalesce((select jsonb_agg(race_id) from election_voter_votes where voter_id = v.id), '[]'::jsonb));
end $fn$;

-- Cast one office. A repeat for the same office is refused, so a choice cannot be changed or doubled.
create or replace function public.link_vote_cast(p_election_id uuid, p_code text, p_name text, p_race_id uuid, p_option_id uuid, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare r jsonb; v election_voters; n int;
begin
  r := _link_vote_auth(p_election_id, p_code, p_name, p_ip_hash);
  if r ->> 'error' is not null then return jsonb_build_object('ok', false, 'error', r ->> 'error'); end if;
  select * into v from election_voters where id = (r ->> 'voter_id')::uuid for update;
  if v.voted_kiosk is not null then return jsonb_build_object('ok', false, 'error', 'voted_at_kiosk'); end if;
  if not exists (select 1 from live_vote_events where id = p_race_id and election_id = p_election_id) then
    return jsonb_build_object('ok', false, 'error', 'bad_choice');
  end if;
  if not exists (select 1 from live_vote_options where id = p_option_id and event_id = p_race_id) then
    return jsonb_build_object('ok', false, 'error', 'bad_choice');
  end if;
  insert into election_voter_votes (voter_id, race_id, election_id) values (v.id, p_race_id, p_election_id)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'already_voted_office'); end if;
  insert into live_votes (event_id, option_id, voter_token) values (p_race_id, p_option_id, gen_random_uuid());
  update election_voters set voted_at = coalesce(voted_at, now()) where id = v.id;
  insert into election_audit (election_id, kiosk_id, kind) values (p_election_id, null, 'link_ballot');
  return jsonb_build_object('ok', true);
end $fn$;

revoke all on function public._link_vote_auth(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.link_vote_open(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.link_vote_cast(uuid, text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.link_vote_open(uuid, text, text, text) to service_role;
grant execute on function public.link_vote_cast(uuid, text, text, uuid, uuid, text) to service_role;
grant execute on function public._link_vote_auth(uuid, text, text, text) to service_role;

-- A practice-election reset also forgets link votes and lockouts.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.reset_school_election(uuid)'::regprocedure) into d;
  if d not like '%election_voter_votes%' then
    d := regexp_replace(d, '(delete from election_audit where election_id = el\.id;)',
         E'\\1\n  delete from election_voter_votes where election_id = el.id;\n  delete from election_link_attempts where election_id = el.id;');
    execute d;
  end if;
end $do$;
