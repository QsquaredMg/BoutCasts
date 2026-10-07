-- Admin edit/delete/archive at ANY status (in progress, closed, final).
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1. Archive any item regardless of status (a live vote is closed first so voting stops).
create or replace function admin_archive_item(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if p_type = 'bout' then
    update bouts set archived_at = now() where id = p_id and archived_at is null and deleted_at is null;
    get diagnostics n = row_count; if n = 0 then raise exception 'Bout not found'; end if;
  elsif p_type = 'live_vote' then
    update live_vote_events set archived_at = now(),
           status = case when status = 'live' then 'closed' else status end,
           closes_at = case when status = 'live' then now() else closes_at end
     where id = p_id and archived_at is null;
    get diagnostics n = row_count; if n = 0 then raise exception 'Live vote not found'; end if;
  elsif p_type = 'pred_slate' then
    update pred_slates set archived_at = now() where id = p_id and archived_at is null;
    get diagnostics n = row_count; if n = 0 then raise exception 'Bracket not found'; end if;
  elsif p_type = 'pred_game' then
    update pred_games set archived_at = now() where id = p_id and archived_at is null and slate_id is null;
    get diagnostics n = row_count; if n = 0 then raise exception 'Single game not found'; end if;
  else raise exception 'Unknown item type'; end if;
end $$;

-- 2. Delete at any stage. Items with payment records need p_force = true (the app asks for a second confirmation).
drop function if exists admin_delete_live_vote(uuid);
create or replace function admin_delete_live_vote(p_id uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if not p_force and archive_item_has_money('live_vote', p_id) then
    raise exception 'MONEY: this live vote has payment records';
  end if;
  delete from live_vote_events where id = p_id;
  if not found then raise exception 'Live vote not found'; end if;
end $$;

drop function if exists admin_delete_pred(text, uuid);
create or replace function admin_delete_pred(p_kind text, p_id uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if p_kind = 'bracket' then
    if not p_force and archive_item_has_money('pred_slate', p_id) then
      raise exception 'MONEY: this bracket was paid for';
    end if;
    delete from pred_games where slate_id = p_id;
    delete from pred_slates where id = p_id;
    if not found then raise exception 'Bracket not found'; end if;
  elsif p_kind = 'game' then
    delete from pred_games where id = p_id and slate_id is null;
    if not found then raise exception 'Game not found (games inside a bracket are deleted with the bracket)'; end if;
  else raise exception 'Unknown kind'; end if;
end $$;

create or replace function admin_delete_debate_topic(p_topic_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not debate_is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  delete from debate_topics where id = p_topic_id;
  if not found then raise exception 'Debate not found'; end if;
end $$;

-- 3. Edit at any stage.
create or replace function admin_update_live_vote(
  p_id uuid, p_title text, p_description text, p_status text,
  p_closes_at timestamptz, p_clear_close boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_user() then raise exception 'Admins only'; end if;
  if p_status is not null and p_status not in ('draft','live','closed') then raise exception 'Unknown status'; end if;
  if p_title is not null and btrim(p_title) = '' then raise exception 'Title cannot be empty'; end if;
  update live_vote_events set
      title = coalesce(nullif(btrim(p_title), ''), title),
      description = case when p_description is null then description else p_description end,
      status = coalesce(p_status, status),
      closes_at = case when p_clear_close then null else coalesce(p_closes_at, closes_at) end
   where id = p_id;
  if not found then raise exception 'Live vote not found'; end if;
end $$;

create or replace function admin_update_showcase(
  p_id uuid, p_title text, p_description text, p_status text,
  p_closes_at timestamptz, p_clear_close boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('draft','live','closed') then raise exception 'Unknown status'; end if;
  if p_title is not null and btrim(p_title) = '' then raise exception 'Title cannot be empty'; end if;
  update showcases set
      title = coalesce(nullif(btrim(p_title), ''), title),
      description = case when p_description is null then description else p_description end,
      status = coalesce(p_status, status),
      closes_at = case when p_clear_close then null else coalesce(p_closes_at, closes_at) end,
      -- reopening clears the old result so it can be decided again
      winner_choice_id = case when p_status in ('draft','live') then null else winner_choice_id end,
      closed_at = case when p_status in ('draft','live') then null else closed_at end
   where id = p_id;
  if not found then raise exception 'Showcase not found'; end if;
end $$;

-- Single or bracket game: names, start time, and (non-bracket games) status. Any status.
create or replace function admin_update_pred_game(
  p_id uuid, p_home_name text, p_away_name text, p_starts_at timestamptz, p_status text default null) returns void
language plpgsql security definer set search_path = public as $$
declare g pred_games; h text; a text;
begin
  if not pred_is_admin() then raise exception 'Admins only'; end if;
  select * into g from pred_games where id = p_id for update;
  if not found then raise exception 'Game not found'; end if;
  h := coalesce(nullif(btrim(p_home_name), ''), g.home_name);
  a := coalesce(nullif(btrim(p_away_name), ''), g.away_name);
  if lower(h) = lower(a) and h <> 'TBD' then raise exception 'Pick two different teams'; end if;
  update pred_games set home_name = h, away_name = a,
      starts_at = coalesce(p_starts_at, starts_at),
      dup_key = case when g.round is null then pred_dup_key(h, a) else dup_key end
   where id = p_id;
  if p_status is not null and p_status <> g.status then
    if g.round is not null then raise exception 'Bracket game results are changed by entering the score'; end if;
    if p_status = 'scheduled' then
      update pred_games set status = 'scheduled', home_score = null, away_score = null, finalized_at = null, finalized_by = null where id = p_id;
      update pred_predictions set pts_entry = null, pts_winner = null, pts_exact = null, pts_close = null, pts_total = null, graded_at = null where game_id = p_id;
    elsif p_status = 'cancelled' then
      update pred_games set status = 'cancelled', home_score = null, away_score = null, finalized_at = null, finalized_by = null where id = p_id;
      update pred_predictions set pts_entry = null, pts_winner = null, pts_exact = null, pts_close = null, pts_total = null, graded_at = null where game_id = p_id;
    else raise exception 'To mark a game final, enter its score';
    end if;
  end if;
end $$;

create or replace function admin_update_pred_slate(
  p_id uuid, p_title text, p_closes_at timestamptz, p_clear_close boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pred_is_admin() then raise exception 'Admins only'; end if;
  update pred_slates set
      title = coalesce(nullif(btrim(p_title), ''), title),
      closes_at = case when p_clear_close then null else coalesce(p_closes_at, closes_at) end
   where id = p_id;
  if not found then raise exception 'Bracket not found'; end if;
end $$;

grant execute on function admin_archive_item(text, uuid) to authenticated;
grant execute on function admin_delete_live_vote(uuid, boolean) to authenticated;
grant execute on function admin_delete_pred(text, uuid, boolean) to authenticated;
grant execute on function admin_delete_debate_topic(uuid) to authenticated;
grant execute on function admin_update_live_vote(uuid, text, text, text, timestamptz, boolean) to authenticated;
grant execute on function admin_update_showcase(uuid, text, text, text, timestamptz, boolean) to authenticated;
grant execute on function admin_update_pred_game(uuid, text, text, timestamptz, text) to authenticated;
grant execute on function admin_update_pred_slate(uuid, text, timestamptz, boolean) to authenticated;
