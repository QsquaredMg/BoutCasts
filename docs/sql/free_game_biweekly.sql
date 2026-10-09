-- Organizers get one free single game every 2 weeks (was: one a day).
-- Only create_pred_game changes: the free-single-game check now looks back 14 days.
-- The free game itself is unchanged: it must start within 24 hours and stays open 24 hours.
-- Safe to run more than once.

create or replace function public.create_pred_game(p_home_name text, p_home_logo text, p_away_name text, p_away_logo text, p_starts_at timestamp with time zone, p_slate_id uuid, p_allow_draw boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare uid uuid := auth.uid(); k text; dup uuid; gid uuid; s pred_slates; adm boolean := pred_is_admin();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if btrim(coalesce(p_home_name,'')) = '' or btrim(coalesce(p_away_name,'')) = '' then raise exception 'Both teams need a name'; end if;
  if lower(btrim(p_home_name)) = lower(btrim(p_away_name)) then raise exception 'Pick two different teams'; end if;
  if p_starts_at <= now() + interval '1 minute' then raise exception 'Start time must be in the future'; end if;
  if p_starts_at > now() + interval '1 year' then raise exception 'Start time is too far away'; end if;
  if not adm and (select count(*) from pred_games where created_by = uid and created_at > now() - interval '1 day') >= 100 then
    raise exception 'Slow down: you have created a lot of games today';
  end if;
  if p_slate_id is null then
    if not adm then
      if p_starts_at > now() + interval '24 hours' then
        raise exception 'A free single game must start within 24 hours. Create a bracket to schedule further out.';
      end if;
      if exists (select 1 from pred_games where created_by = uid and slate_id is null and created_at > now() - interval '14 days') then
        raise exception 'You already used your free single game for this two-week period. Create a bracket to schedule more games.';
      end if;
    end if;
  else
    s := (select z from pred_slates z where z.id = p_slate_id);
    if s.id is null or s.kind <> 'slate' or not (s.created_by = uid or adm) then
      raise exception 'You can only add games to your own game slate';
    end if;
    if not adm and (s.status = 'closed' or (s.closes_at is not null and s.closes_at <= now())) then raise exception 'This bracket has closed'; end if;
    if (select count(*) from pred_games where slate_id = p_slate_id) >= 64 then raise exception 'A slate holds up to 64 games'; end if;
    if s.closes_at is not null and p_starts_at > s.closes_at and not adm then raise exception 'That start time is after the bracket closes'; end if;
  end if;
  k := pred_dup_key(p_home_name, p_away_name);
  perform pg_advisory_xact_lock(hashtext(k));
  dup := (select id from pred_games
   where dup_key = k and status <> 'cancelled' and starts_at between p_starts_at - interval '3 hours' and p_starts_at + interval '3 hours'
   order by starts_at limit 1);
  if dup is not null then
    return jsonb_build_object('ok', false, 'duplicate', true, 'existing_id', dup);
  end if;
  insert into pred_games(slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, allow_draw, dup_key)
  values (p_slate_id, uid, btrim(p_home_name), nullif(btrim(coalesce(p_home_logo,'')),''), btrim(p_away_name), nullif(btrim(coalesce(p_away_logo,'')),''), p_starts_at, coalesce(p_allow_draw,false), k);
  gid := (select id from pred_games where created_by = uid and dup_key = k order by created_at desc limit 1);
  return jsonb_build_object('ok', true, 'id', gid);
end $fn$;
