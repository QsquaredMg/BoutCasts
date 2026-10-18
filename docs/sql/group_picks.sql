-- Group picks: an organizer or admin enters picks for several people (e.g. a work group) on one game.
-- Run each numbered block separately in the Supabase SQL editor. Safe to re-run.

-- 1) Table
create table if not exists public.pred_entrant_picks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.pred_games(id) on delete cascade,
  entrant_name text not null check (char_length(btrim(entrant_name)) between 1 and 60),
  pred_home integer not null check (pred_home between 0 and 999),
  pred_away integer not null check (pred_away between 0 and 999),
  entered_by uuid references auth.users(id) on delete set null,
  pts_entry integer,
  pts_winner integer,
  pts_exact integer,
  pts_close integer,
  pts_total integer,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pred_entrant_picks_one_per_name on public.pred_entrant_picks (game_id, (lower(btrim(entrant_name))));
create index if not exists pred_entrant_picks_game_idx on public.pred_entrant_picks (game_id);
alter table public.pred_entrant_picks enable row level security;
revoke all on public.pred_entrant_picks from anon, authenticated;
grant select on public.pred_entrant_picks to anon, authenticated;

-- Visible to everyone once picks are closed; before that only the organizer and admins see them.
drop policy if exists pred_entrant_picks_read on public.pred_entrant_picks;
create policy pred_entrant_picks_read on public.pred_entrant_picks for select using (
  exists (
    select 1 from public.pred_games g
     where g.id = pred_entrant_picks.game_id
       and (g.status <> 'scheduled' or now() >= g.starts_at + public.pred_lock_grace()
            or g.created_by = (select auth.uid()) or public.pred_is_admin())
  )
);

-- 2) Save picks for a group (organizer before picks close, admin any time before the game is final)
create or replace function public.set_entrant_picks(p_game uuid, p_picks jsonb)
returns integer language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); g pred_games; n integer := 0; r record; nm text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from pred_games where id = p_game;
  if not found then raise exception 'Game not found'; end if;
  if not (g.created_by = uid or pred_is_admin()) then raise exception 'Only the organizer can enter picks for others'; end if;
  if g.status = 'cancelled' then raise exception 'This game was cancelled'; end if;
  if g.status = 'final' then raise exception 'This game is final'; end if;
  if not pred_is_admin() and (g.status <> 'scheduled' or now() >= g.starts_at + pred_lock_grace()) then
    raise exception 'Picks are closed for this game';
  end if;
  if p_picks is null or jsonb_typeof(p_picks) <> 'array' then raise exception 'Send a list of picks'; end if;
  if jsonb_array_length(p_picks) > 200 then raise exception 'Up to 200 picks at a time'; end if;
  for r in select * from jsonb_to_recordset(p_picks) as x(name text, pred_home integer, pred_away integer) loop
    nm := btrim(coalesce(r.name, ''));
    if char_length(nm) < 1 or char_length(nm) > 60 then raise exception 'Each pick needs a name of 1 to 60 characters'; end if;
    if r.pred_home is null or r.pred_away is null or r.pred_home < 0 or r.pred_away < 0 or r.pred_home > 999 or r.pred_away > 999 then
      raise exception 'Scores must be whole numbers from 0 to 999 (%).', nm;
    end if;
    if r.pred_home = r.pred_away and not g.allow_draw then raise exception 'This game cannot end in a tie (%).', nm; end if;
    insert into pred_entrant_picks (game_id, entrant_name, pred_home, pred_away, entered_by)
    values (p_game, nm, r.pred_home, r.pred_away, uid)
    on conflict (game_id, (lower(btrim(entrant_name)))) do update
      set pred_home = excluded.pred_home, pred_away = excluded.pred_away, entrant_name = excluded.entrant_name,
          entered_by = excluded.entered_by, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $fn$;
revoke all on function public.set_entrant_picks(uuid, jsonb) from public, anon;
grant execute on function public.set_entrant_picks(uuid, jsonb) to authenticated;

-- 3) Remove one entered pick
create or replace function public.delete_entrant_pick(p_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid := auth.uid(); g pred_games; e pred_entrant_picks;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into e from pred_entrant_picks where id = p_id;
  if not found then return; end if;
  select * into g from pred_games where id = e.game_id;
  if not (g.created_by = uid or pred_is_admin()) then raise exception 'Only the organizer can remove picks'; end if;
  if g.status = 'final' then raise exception 'This game is final'; end if;
  if not pred_is_admin() and (g.status <> 'scheduled' or now() >= g.starts_at + pred_lock_grace()) then
    raise exception 'Picks are closed for this game';
  end if;
  delete from pred_entrant_picks where id = p_id;
end $fn$;
revoke all on function public.delete_entrant_pick(uuid) from public, anon;
grant execute on function public.delete_entrant_pick(uuid) to authenticated;

-- 4) Grade entered picks automatically when the final score is saved (and clear them if the game is reopened)
create or replace function public.grade_entrant_picks()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.status = 'final' and new.home_score is not null and new.away_score is not null then
    update pred_entrant_picks e
       set pts_entry = x.entry, pts_winner = x.winner, pts_exact = x.exact, pts_close = x.close, pts_total = x.total, graded_at = now()
      from (select ep.id, (pred_grade_ver(ep.pred_home, ep.pred_away, new.home_score, new.away_score, new.scoring_version)).*
              from pred_entrant_picks ep where ep.game_id = new.id) x
     where e.id = x.id;
  else
    update pred_entrant_picks
       set pts_entry = null, pts_winner = null, pts_exact = null, pts_close = null, pts_total = null, graded_at = null
     where game_id = new.id and graded_at is not null;
  end if;
  return null;
end $fn$;
drop trigger if exists grade_entrant_picks_trg on public.pred_games;
create trigger grade_entrant_picks_trg after update of status, home_score, away_score on public.pred_games
  for each row execute function public.grade_entrant_picks();

-- 5) Season standings for entered picks inside one slate (merged into the slate leaderboard)
create or replace function public.pred_entrant_standings(p_slate uuid)
returns table(entrant_name text, points bigint, games bigint, winners bigint, perfect bigint)
language sql stable security definer set search_path = public as $fn$
  select min(e.entrant_name), sum(e.pts_total)::bigint, count(*)::bigint,
         count(*) filter (where e.pts_winner > 0)::bigint, count(*) filter (where e.pts_exact = 6)::bigint
    from pred_entrant_picks e join pred_games g on g.id = e.game_id
   where g.slate_id = p_slate and g.status = 'final' and e.graded_at is not null
   group by lower(btrim(e.entrant_name))
   order by 2 desc
   limit 100
$fn$;
grant execute on function public.pred_entrant_standings(uuid) to anon, authenticated;
