-- Open-ended school elections (admin only) + keep kiosk votes out of the live feed.
-- Run after the earlier kiosk scripts. Safe to run more than once.

alter table public.school_elections add column if not exists open_ended boolean not null default false;

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

create or replace function public.live_votes_to_feed()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if exists (select 1 from live_vote_events e where e.id = new.event_id and e.election_id is not null) then
    return new;
  end if;
  insert into live_vote_tally_feed(event_id, option_id) values (new.event_id, new.option_id);
  return new;
end $fn$;
