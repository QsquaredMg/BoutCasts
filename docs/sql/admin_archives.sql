-- Admin archive / delete / scheduled dump for bouts, live votes and predictions.
-- Flow: Archive (hidden, restorable) -> dump (monthly via pg_cron, or "Run archive now") ->
-- admin downloads the dump -> admin confirms -> rows purged and clip files deleted.
-- Items with payment records are never purged. Nothing is purged before a human confirms the download.

-- 1. Archive markers ---------------------------------------------------------
alter table bouts            add column if not exists archived_at timestamptz;
alter table bouts            add column if not exists archive_dump_id uuid;
alter table live_vote_events add column if not exists archived_at timestamptz;
alter table live_vote_events add column if not exists archive_dump_id uuid;
alter table pred_slates      add column if not exists archived_at timestamptz;
alter table pred_slates      add column if not exists archive_dump_id uuid;
alter table pred_games       add column if not exists archived_at timestamptz;
alter table pred_games       add column if not exists archive_dump_id uuid;

create table if not exists archive_dumps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger text not null check (trigger in ('auto','manual')),
  created_by uuid,
  counts jsonb not null default '{}',
  item_ids jsonb not null default '{}',
  files jsonb not null default '[]',
  payload_bytes bigint not null default 0,
  downloaded_at timestamptz,
  purged_at timestamptz,
  purged_by uuid,
  purge_summary jsonb,
  files_purged_at timestamptz
);
create table if not exists archive_payloads (dump_id uuid primary key references archive_dumps(id) on delete cascade, payload jsonb not null);
alter table archive_dumps enable row level security;
alter table archive_payloads enable row level security;
drop policy if exists archive_dumps_admin_read on archive_dumps;
create policy archive_dumps_admin_read on archive_dumps for select using (is_admin_user());

-- 2. Hide archived items from the site (admins still see archived predictions/live votes) --
drop policy if exists bouts_select_all on bouts;
create policy bouts_select_all on bouts for select using (deleted_at is null and archived_at is null);

drop policy if exists live_vote_events_select on live_vote_events;
create policy live_vote_events_select on live_vote_events for select using (
  archived_at is null and (
    ((status = any (array['live','closed'])) and ((not is_private) or (id = (select request_event_id()))))
    or (organizer_id = (select auth.uid()))
  )
);

drop policy if exists pred_slates_read on pred_slates;
create policy pred_slates_read on pred_slates for select using (
  ((status <> 'pending') or (created_by = (select auth.uid())) or pred_is_admin())
  and (archived_at is null or pred_is_admin())
);
drop policy if exists pred_games_read on pred_games;
create policy pred_games_read on pred_games for select using (
  (slate_id is null and (archived_at is null or pred_is_admin()))
  or exists (select 1 from pred_slates s where s.id = pred_games.slate_id)
);

-- 3. Money guard -------------------------------------------------------------
create or replace function archive_item_has_money(p_type text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_type = 'live_vote' then
    return exists (select 1 from live_vote_events e where e.id = p_id and (coalesce(e.price_cents,0) > 0 or e.stripe_checkout_session_id is not null
                   or e.pro_checkout_session_id is not null or e.super_votes_checkout_session_id is not null))
        or exists (select 1 from event_sponsorships s where s.event_id = p_id);
  elsif p_type = 'pred_slate' then
    return exists (select 1 from pred_slates s where s.id = p_id and ((s.stripe_session_id is not null and s.stripe_session_id not like 'admin-comp-%') or s.upgrade_session_id is not null));
  end if;
  return false;
end $$;
revoke all on function archive_item_has_money(text, uuid) from public, anon, authenticated;

-- 4. Archive / restore / hard delete (admin) -------------------------------
create or replace function admin_archive_item(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if p_type = 'bout' then
    update bouts set archived_at = now() where id = p_id and archived_at is null and deleted_at is null and status = 'final';
    get diagnostics n = row_count; if n = 0 then raise exception 'Only finished bouts can be archived'; end if;
  elsif p_type = 'live_vote' then
    update live_vote_events set archived_at = now() where id = p_id and archived_at is null and status in ('closed','draft');
    get diagnostics n = row_count; if n = 0 then raise exception 'Close the live vote before archiving it'; end if;
  elsif p_type = 'pred_slate' then
    update pred_slates set archived_at = now() where id = p_id and archived_at is null and status in ('closed','pending');
    get diagnostics n = row_count; if n = 0 then raise exception 'End the bracket before archiving it'; end if;
  elsif p_type = 'pred_game' then
    update pred_games set archived_at = now() where id = p_id and archived_at is null and slate_id is null and status in ('final','cancelled');
    get diagnostics n = row_count; if n = 0 then raise exception 'Only finished or cancelled single games can be archived'; end if;
  else raise exception 'Unknown item type'; end if;
end $$;

create or replace function admin_restore_archived(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int; d uuid;
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if p_type = 'bout' then select archive_dump_id into d from bouts where id = p_id;
  elsif p_type = 'live_vote' then select archive_dump_id into d from live_vote_events where id = p_id;
  elsif p_type = 'pred_slate' then select archive_dump_id into d from pred_slates where id = p_id;
  elsif p_type = 'pred_game' then select archive_dump_id into d from pred_games where id = p_id;
  else raise exception 'Unknown item type'; end if;
  if d is not null and exists (select 1 from archive_dumps where id = d and purged_at is not null) then raise exception 'This item was already purged'; end if;
  if p_type = 'bout' then update bouts set archived_at = null, archive_dump_id = null where id = p_id and archived_at is not null;
  elsif p_type = 'live_vote' then update live_vote_events set archived_at = null, archive_dump_id = null where id = p_id and archived_at is not null;
  elsif p_type = 'pred_slate' then update pred_slates set archived_at = null, archive_dump_id = null where id = p_id and archived_at is not null;
  else update pred_games set archived_at = null, archive_dump_id = null where id = p_id and archived_at is not null; end if;
  get diagnostics n = row_count; if n = 0 then raise exception 'Item is not archived'; end if;
end $$;

create or replace function admin_delete_live_vote(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if exists (select 1 from live_vote_events where id = p_id and status = 'live') then raise exception 'Close the live vote before deleting it'; end if;
  if archive_item_has_money('live_vote', p_id) then raise exception 'This live vote has payment records, so it can only be archived, not deleted'; end if;
  delete from live_vote_events where id = p_id;
  if not found then raise exception 'Live vote not found'; end if;
end $$;

create or replace function admin_delete_pred(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if p_kind = 'bracket' then
    if archive_item_has_money('pred_slate', p_id) then raise exception 'This bracket was paid for, so it can only be archived, not deleted'; end if;
    delete from pred_games where slate_id = p_id;
    delete from pred_slates where id = p_id;
    if not found then raise exception 'Bracket not found'; end if;
  elsif p_kind = 'game' then
    delete from pred_games where id = p_id and slate_id is null;
    if not found then raise exception 'Game not found (games inside a bracket are deleted with the bracket)'; end if;
  else raise exception 'Unknown kind'; end if;
end $$;

grant execute on function admin_archive_item(text, uuid), admin_restore_archived(text, uuid),
  admin_delete_live_vote(uuid), admin_delete_pred(text, uuid) to authenticated;

-- 5. Auto-mark old finished items -------------------------------------------
create or replace function archive_auto_mark(p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int; cutoff timestamptz := now() - make_interval(days => p_days);
begin
  update bouts b set archived_at = now() where b.archived_at is null and b.deleted_at is null and b.status = 'final' and b.closes_at < cutoff
     and (b.bracket_key is null or not exists (select 1 from bouts o where o.bracket_key = b.bracket_key and o.deleted_at is null and (o.status <> 'final' or o.closes_at >= cutoff)));
  get diagnostics a = row_count;
  update live_vote_events e set archived_at = now() where e.archived_at is null and e.status = 'closed' and coalesce(e.closes_at, e.created_at) < cutoff;
  get diagnostics b = row_count;
  update pred_slates s set archived_at = now() where s.archived_at is null and s.status = 'closed'
     and not exists (select 1 from pred_games g where g.slate_id = s.id and (g.status = 'scheduled' or g.starts_at >= cutoff));
  get diagnostics c = row_count;
  update pred_games g set archived_at = now() where g.archived_at is null and g.slate_id is null and g.round is null and g.status in ('final','cancelled') and g.starts_at < cutoff;
  get diagnostics d = row_count;
  return jsonb_build_object('bouts', a, 'live_votes', b, 'pred_slates', c, 'pred_games', d);
end $$;
revoke all on function archive_auto_mark(int) from public, anon, authenticated;

-- 6. Build the dump -----------------------------------------------------------
create or replace function archive_rows(p_tbl regclass, p_col text, p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %s t where %I = any($1)', p_tbl, p_col) into r using p_ids;
  return r;
end $$;
revoke all on function archive_rows(regclass, text, uuid[]) from public, anon, authenticated;

create or replace function archive_run_core(p_auto_days int, p_trigger text, p_by uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  did uuid; bo uuid[]; lv uuid[]; ps uuid[]; pg uuid[]; sub uuid[]; gm uuid[]; payload jsonb; files jsonb; marked jsonb := '{}';
begin
  if p_auto_days is not null then marked := archive_auto_mark(p_auto_days); end if;
  select coalesce(array_agg(id), '{}') into bo from bouts where archived_at is not null and archive_dump_id is null and deleted_at is null;
  select coalesce(array_agg(id), '{}') into lv from live_vote_events where archived_at is not null and archive_dump_id is null;
  select coalesce(array_agg(id), '{}') into ps from pred_slates where archived_at is not null and archive_dump_id is null;
  select coalesce(array_agg(id), '{}') into pg from pred_games where archived_at is not null and archive_dump_id is null and slate_id is null;
  if cardinality(bo) + cardinality(lv) + cardinality(ps) + cardinality(pg) = 0 then return null; end if;

  select coalesce(array_agg(x), '{}') into sub from (
    select competitor_a_submission_id x from bouts where id = any(bo) union select competitor_b_submission_id from bouts where id = any(bo)) q where x is not null;
  select coalesce(array_agg(id), '{}') into gm from pred_games where slate_id = any(ps);

  payload := jsonb_build_object(
    'generated_at', now(),
    'bouts', jsonb_build_object(
      'bouts', archive_rows('bouts','id',bo), 'submissions', archive_rows('submissions','id',sub),
      'votes', archive_rows('votes','bout_id',bo), 'bout_comments', archive_rows('bout_comments','bout_id',bo),
      'prize_pools', archive_rows('prize_pools','bout_id',bo), 'point_events', archive_rows('point_events','related_bout_id',bo)),
    'live_votes', jsonb_build_object(
      'live_vote_events', archive_rows('live_vote_events','id',lv), 'live_vote_options', archive_rows('live_vote_options','event_id',lv),
      'live_votes', archive_rows('live_votes','event_id',lv), 'live_vote_rankings', archive_rows('live_vote_rankings','event_id',lv),
      'live_vote_tally_feed', archive_rows('live_vote_tally_feed','event_id',lv), 'live_vote_criteria', archive_rows('live_vote_criteria','event_id',lv),
      'live_vote_judges', archive_rows('live_vote_judges','event_id',lv), 'live_vote_demographics', archive_rows('live_vote_demographics','event_id',lv),
      'live_vote_sponsors', archive_rows('live_vote_sponsors','event_id',lv), 'live_vote_judge_notes', archive_rows('live_vote_judge_notes','event_id',lv),
      'live_vote_super_votes', archive_rows('live_vote_super_votes','event_id',lv), 'live_vote_sponsor_events', archive_rows('live_vote_sponsor_events','event_id',lv),
      'event_sponsor_packages', archive_rows('event_sponsor_packages','event_id',lv), 'event_sponsorships', archive_rows('event_sponsorships','event_id',lv)),
    'predictions', jsonb_build_object(
      'pred_slates', archive_rows('pred_slates','id',ps), 'pred_games', archive_rows('pred_games','slate_id',ps) || archive_rows('pred_games','id',pg),
      'pred_predictions', archive_rows('pred_predictions','game_id',gm || pg), 'pred_bracket_teams', archive_rows('pred_bracket_teams','bracket_id',ps),
      'pred_bracket_picks', archive_rows('pred_bracket_picks','bracket_id',ps), 'pred_sponsors', archive_rows('pred_sponsors','bracket_id',ps),
      'pred_sponsor_events', archive_rows('pred_sponsor_events','bracket_id',ps))
  );

  -- clip files referenced by the dump (uploads in the submission-clips bucket)
  select coalesce(jsonb_agg(distinct jsonb_build_object('bucket', m[1], 'path', m[2])), '[]') into files
    from regexp_matches(payload::text, 'storage/v1/object/(?:public|sign)/(submission-clips)/([^"?\\]+)', 'g') as m;

  did := gen_random_uuid();
  insert into archive_dumps(id, trigger, created_by, counts, item_ids, files, payload_bytes)
  values (did, p_trigger, p_by,
          jsonb_build_object('bouts', cardinality(bo), 'live_votes', cardinality(lv), 'pred_slates', cardinality(ps), 'pred_games', cardinality(pg), 'auto_marked', marked),
          jsonb_build_object('bouts', to_jsonb(bo), 'live_votes', to_jsonb(lv), 'pred_slates', to_jsonb(ps), 'pred_games', to_jsonb(pg), 'submissions', to_jsonb(sub)),
          files, octet_length(payload::text));
  insert into archive_payloads(dump_id, payload) values (did, payload);
  update bouts set archive_dump_id = did where id = any(bo);
  update live_vote_events set archive_dump_id = did where id = any(lv);
  update pred_slates set archive_dump_id = did where id = any(ps);
  update pred_games set archive_dump_id = did where id = any(pg);

  insert into notifications(user_id, type, body, link)
  select p.id, 'archive_ready', 'A new archive dump is ready to download.', '/admin/archives' from profiles p where p.is_admin;
  return did;
end $$;
revoke all on function archive_run_core(int, text, uuid) from public, anon, authenticated;

create or replace function admin_archive_run() returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  return archive_run_core(null, 'manual', auth.uid());
end $$;
grant execute on function admin_archive_run() to authenticated;

-- 7. Purge after the admin confirms they downloaded the dump -------------
create or replace function admin_archive_purge(p_dump uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d archive_dumps; t text; i uuid; ids uuid[]; deleted jsonb := jsonb_build_object('bouts',0,'live_votes',0,'pred_slates',0,'pred_games',0,'submissions',0);
  kept jsonb := '[]'; n int; ok_lv uuid[] := '{}'; ok_ps uuid[] := '{}'; sub uuid[]; delfiles jsonb := '[]'; f jsonb; used boolean;
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  select * into d from archive_dumps where id = p_dump for update;
  if not found then raise exception 'Dump not found'; end if;
  if d.downloaded_at is null then raise exception 'Download the dump before purging'; end if;
  if d.purged_at is not null then raise exception 'Already purged'; end if;

  -- bouts
  ids := array(select jsonb_array_elements_text(d.item_ids -> 'bouts')::uuid);
  perform set_config('boutcasts.purge', 'on', true);
  delete from bouts where id = any(ids) and archived_at is not null;
  get diagnostics n = row_count; deleted := jsonb_set(deleted, '{bouts}', to_jsonb(n));
  perform set_config('boutcasts.purge', 'off', true);
  sub := array(select jsonb_array_elements_text(d.item_ids -> 'submissions')::uuid);
  delete from submissions s where s.id = any(sub)
     and not exists (select 1 from bouts b where b.competitor_a_submission_id = s.id or b.competitor_b_submission_id = s.id);
  get diagnostics n = row_count; deleted := jsonb_set(deleted, '{submissions}', to_jsonb(n));

  -- live votes (events with payment records are kept)
  for i in select jsonb_array_elements_text(d.item_ids -> 'live_votes')::uuid loop
    if archive_item_has_money('live_vote', i) then kept := kept || jsonb_build_object('type','live_vote','id',i);
    else ok_lv := ok_lv || i; end if;
  end loop;
  delete from live_vote_events where id = any(ok_lv) and archived_at is not null;
  get diagnostics n = row_count; deleted := jsonb_set(deleted, '{live_votes}', to_jsonb(n));

  -- prediction brackets (paid ones are kept); games first because slate_id is set null on delete
  for i in select jsonb_array_elements_text(d.item_ids -> 'pred_slates')::uuid loop
    if archive_item_has_money('pred_slate', i) then kept := kept || jsonb_build_object('type','pred_slate','id',i);
    else ok_ps := ok_ps || i; end if;
  end loop;
  delete from pred_games where slate_id = any(ok_ps);
  delete from pred_slates where id = any(ok_ps) and archived_at is not null;
  get diagnostics n = row_count; deleted := jsonb_set(deleted, '{pred_slates}', to_jsonb(n));
  ids := array(select jsonb_array_elements_text(d.item_ids -> 'pred_games')::uuid);
  delete from pred_games where id = any(ids) and slate_id is null and archived_at is not null;
  get diagnostics n = row_count; deleted := jsonb_set(deleted, '{pred_games}', to_jsonb(n));

  -- clip files that nothing else still references
  for f in select * from jsonb_array_elements(d.files) loop
    used := exists (select 1 from submissions s where strpos(coalesce(s.source_url,''), (f ->> 'bucket') || '/' || (f ->> 'path')) > 0)
         or exists (select 1 from live_vote_options o where strpos(coalesce(o.source_url,'') || ' ' || coalesce(o.thumbnail_url,'') || ' ' || coalesce(o.image_url,''), (f ->> 'bucket') || '/' || (f ->> 'path')) > 0)
         or exists (select 1 from live_vote_events e where strpos(coalesce(e.cover_image_url,'') || ' ' || coalesce(e.brand_bg_image_url,'') || ' ' || coalesce(e.post_vote_graphic_url,''), (f ->> 'bucket') || '/' || (f ->> 'path')) > 0);
    if not used then delfiles := delfiles || f; end if;
  end loop;

  update archive_dumps set purged_at = now(), purged_by = auth.uid(), purge_summary = jsonb_build_object('deleted', deleted, 'kept', kept, 'files_to_delete', jsonb_array_length(delfiles)),
         files = delfiles where id = p_dump;
  delete from archive_payloads where dump_id = p_dump;
  return jsonb_build_object('deleted', deleted, 'kept', kept, 'files', delfiles);
end $$;
grant execute on function admin_archive_purge(uuid) to authenticated;
-- NOTE: the payload is removed on purge, so the downloaded file is then the only copy.

create or replace function admin_archive_files_done(p_dump uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  update archive_dumps set files_purged_at = now(), files = '[]' where id = p_dump and purged_at is not null;
end $$;
grant execute on function admin_archive_files_done(uuid) to authenticated;

-- 8. Admin lists --------------------------------------------------------------
create or replace function admin_list_archived() returns table(type text, id uuid, title text, archived_at timestamptz, dump_id uuid, has_money boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  return query
    select 'bout'::text, b.id, b.title, b.archived_at, b.archive_dump_id, false from bouts b where b.archived_at is not null and b.deleted_at is null
    union all select 'live_vote', e.id, e.title, e.archived_at, e.archive_dump_id, archive_item_has_money('live_vote', e.id) from live_vote_events e where e.archived_at is not null
    union all select 'pred_slate', s.id, s.title, s.archived_at, s.archive_dump_id, archive_item_has_money('pred_slate', s.id) from pred_slates s where s.archived_at is not null
    union all select 'pred_game', g.id, g.home_name || ' vs ' || g.away_name, g.archived_at, g.archive_dump_id, false from pred_games g where g.archived_at is not null and g.slate_id is null
    order by 4 desc;
end $$;
grant execute on function admin_list_archived() to authenticated;

-- Archived predictions leave the main admin list (they live on the Archives page).
create or replace function admin_list_predictions()
returns table(kind text, id uuid, title text, status text, tier text, starts_at timestamptz, closes_at timestamptz, owner text, games bigint, picks bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not pred_is_admin() then raise exception 'Admins only'; end if;
  return query
    select 'bracket'::text, s.id, s.title, s.status, s.tier, s.locks_at, s.closes_at, pr.username, (select count(*) from pred_games g where g.slate_id = s.id),
           (select count(*) from pred_bracket_picks b where b.bracket_id = s.id) + (select count(*) from pred_predictions p join pred_games g2 on g2.id = p.game_id where g2.slate_id = s.id), s.created_at
      from pred_slates s left join profiles pr on pr.id = s.created_by where s.archived_at is null
    union all
    select 'game'::text, g.id, g.home_name || ' vs ' || g.away_name, g.status, null::text, g.starts_at, null::timestamptz, pr.username, 1::bigint,
           (select count(*) from pred_predictions p where p.game_id = g.id), g.created_at
      from pred_games g left join profiles pr on pr.id = g.created_by where g.slate_id is null and g.archived_at is null
    order by 11 desc limit 200;
end $$;

-- 9. Monthly schedule: 1st of the month, 09:23 UTC; items finished 90+ days ago ----
select cron.unschedule('archive-monthly') where exists (select 1 from cron.job where jobname = 'archive-monthly');
select cron.schedule('archive-monthly', '23 9 1 * *', $$select public.archive_run_core(90, 'auto', null)$$);
