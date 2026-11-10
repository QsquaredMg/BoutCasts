-- Sponsor library: enter a sponsor once (logo, link, optional commercial), then place it on any of your trivia packs,
-- live votes, prediction brackets or single bouts, each with its own level and private amount. Views, taps and commercial
-- plays are counted per placement. Run once in the Supabase SQL editor (after trivia_sponsors.sql). Safe to re-run.
-- Existing bracket and live-vote sponsors keep working exactly as before; library placements show alongside them.

create table if not exists public.sponsor_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  logo_url text check (logo_url is null or (char_length(logo_url) <= 500 and logo_url ~ '^https://[^\s"''()<>]+$')),
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^https?://[^\s"''<>]+$')),
  -- Optional commercial add-on: a video link (YouTube, Vimeo...) or a picture.
  commercial_url text check (commercial_url is null or (char_length(commercial_url) <= 500 and commercial_url ~ '^https://[^\s"''<>]+$')),
  commercial_kind text check (commercial_kind is null or commercial_kind in ('video','image')),
  created_at timestamptz not null default now()
);
create index if not exists sponsor_library_owner_idx on public.sponsor_library(owner_id);
alter table public.sponsor_library enable row level security;
drop policy if exists sponsor_library_rw on public.sponsor_library;
create policy sponsor_library_rw on public.sponsor_library for all to authenticated
  using (owner_id = auth.uid() or public.is_admin_user())
  with check (owner_id = auth.uid() or public.is_admin_user());

create table if not exists public.sponsor_placements (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsor_library(id) on delete cascade,
  target_kind text not null check (target_kind in ('trivia','vote','bracket','bout')),
  target_id uuid not null,
  level text not null default 'supporter' check (level in ('title','gold','supporter')),
  amount_cents int check (amount_cents is null or amount_cents >= 0),
  with_commercial boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sponsor_id, target_kind, target_id)
);
create index if not exists sponsor_placements_target_idx on public.sponsor_placements(target_kind, target_id);
-- No direct table access: everything goes through the functions below.
alter table public.sponsor_placements enable row level security;

create table if not exists public.sponsor_events (
  id bigserial primary key,
  sponsor_id uuid,
  target_kind text not null,
  target_id uuid not null,
  kind text not null check (kind in ('view','click','commercial')),
  created_at timestamptz not null default now()
);
create index if not exists sponsor_events_target_idx on public.sponsor_events(target_kind, target_id, kind);
create index if not exists sponsor_events_sponsor_idx on public.sponsor_events(sponsor_id, kind);
alter table public.sponsor_events enable row level security;

-- Who may manage sponsors on a target. Votes and brackets follow the paid-event rule the existing sponsor tools use.
create or replace function public.sponsor_can_manage_target(p_kind text, p_target uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case p_kind
    when 'trivia'  then exists (select 1 from public.trivia_packs t where t.id = p_target and (t.owner_id = auth.uid() or public.is_admin_user()))
    when 'vote'    then (public.live_vote_can_moderate(p_target)
                         and (public.is_admin_user() or exists (select 1 from public.live_vote_events e where e.id = p_target and e.tier <> 'free')))
    when 'bracket' then public.pred_owns_paid_bracket(p_target)
    when 'bout'    then public.is_admin_user()
    else false end
$$;
revoke all on function public.sponsor_can_manage_target(text, uuid) from public, anon;
grant execute on function public.sponsor_can_manage_target(text, uuid) to authenticated;

create or replace function public.assign_sponsor(p_sponsor uuid, p_kind text, p_target uuid, p_level text default 'supporter', p_amount_cents int default null, p_commercial boolean default false)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.sponsor_library l where l.id = p_sponsor and (l.owner_id = auth.uid() or public.is_admin_user())) then
    raise exception 'Sponsor not found';
  end if;
  if not public.sponsor_can_manage_target(p_kind, p_target) then
    raise exception 'You can''t add sponsors here (votes and brackets need a paid size)';
  end if;
  if p_level not in ('title','gold','supporter') then raise exception 'Unknown sponsor level'; end if;
  if not exists (select 1 from public.sponsor_placements where sponsor_id = p_sponsor and target_kind = p_kind and target_id = p_target)
     and (select count(*) from public.sponsor_placements where target_kind = p_kind and target_id = p_target) >= 12 then
    raise exception 'Up to 12 sponsors per event';
  end if;
  if p_level = 'title' and exists (select 1 from public.sponsor_placements where target_kind = p_kind and target_id = p_target and level = 'title' and sponsor_id <> p_sponsor) then
    raise exception 'There is already a title sponsor here. Change that one to Gold or Supporter first.';
  end if;
  insert into public.sponsor_placements (sponsor_id, target_kind, target_id, level, amount_cents, with_commercial)
  values (p_sponsor, p_kind, p_target, p_level, p_amount_cents, coalesce(p_commercial, false))
  on conflict (sponsor_id, target_kind, target_id) do update
    set level = excluded.level, amount_cents = excluded.amount_cents, with_commercial = excluded.with_commercial
  returning id into pid;
  return pid;
end $$;
revoke all on function public.assign_sponsor(uuid, text, uuid, text, int, boolean) from public, anon;
grant execute on function public.assign_sponsor(uuid, text, uuid, text, int, boolean) to authenticated;

create or replace function public.update_sponsor_placement(p_id uuid, p_level text, p_amount_cents int, p_commercial boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pl public.sponsor_placements;
begin
  pl := (select z from public.sponsor_placements z where id = p_id);
  if pl.id is null or not public.sponsor_can_manage_target(pl.target_kind, pl.target_id) then raise exception 'Not allowed'; end if;
  if p_level not in ('title','gold','supporter') then raise exception 'Unknown sponsor level'; end if;
  if p_level = 'title' and exists (select 1 from public.sponsor_placements where target_kind = pl.target_kind and target_id = pl.target_id and level = 'title' and id <> p_id) then
    raise exception 'There is already a title sponsor here. Change that one to Gold or Supporter first.';
  end if;
  update public.sponsor_placements set level = p_level, amount_cents = p_amount_cents, with_commercial = coalesce(p_commercial, false) where id = p_id;
end $$;
revoke all on function public.update_sponsor_placement(uuid, text, int, boolean) from public, anon;
grant execute on function public.update_sponsor_placement(uuid, text, int, boolean) to authenticated;

create or replace function public.remove_sponsor_placement(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pl public.sponsor_placements;
begin
  pl := (select z from public.sponsor_placements z where id = p_id);
  if pl.id is null or not public.sponsor_can_manage_target(pl.target_kind, pl.target_id) then raise exception 'Not allowed'; end if;
  delete from public.sponsor_placements where id = p_id;
end $$;
revoke all on function public.remove_sponsor_placement(uuid) from public, anon;
grant execute on function public.remove_sponsor_placement(uuid) to authenticated;

-- What a visitor sees on a page. Never includes amounts. The commercial comes back only when the placement includes it.
create or replace function public.get_sponsor_placements(p_kind text, p_target uuid)
returns table (sponsor_id uuid, name text, logo_url text, link_url text, level text, commercial_url text, commercial_kind text)
language sql stable security definer set search_path to 'public' as $$
  select l.id, l.name, l.logo_url, l.link_url, p.level,
         case when p.with_commercial then l.commercial_url end,
         case when p.with_commercial then l.commercial_kind end
    from public.sponsor_placements p join public.sponsor_library l on l.id = p.sponsor_id
   where p.target_kind = p_kind and p.target_id = p_target
   order by case p.level when 'title' then 0 when 'gold' then 1 else 2 end, p.created_at
   limit 12
$$;
grant execute on function public.get_sponsor_placements(text, uuid) to anon, authenticated;

-- One row per placement on a target, with counts, for the people who run it.
create or replace function public.get_target_sponsors_admin(p_kind text, p_target uuid)
returns table (placement_id uuid, sponsor_id uuid, name text, logo_url text, link_url text, commercial_url text, commercial_kind text,
               level text, amount_cents int, with_commercial boolean, can_edit boolean, views bigint, clicks bigint, commercials bigint)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.sponsor_can_manage_target(p_kind, p_target) then raise exception 'Not allowed'; end if;
  return query
    select p.id, l.id, l.name, l.logo_url, l.link_url, l.commercial_url, l.commercial_kind, p.level, p.amount_cents, p.with_commercial,
           (l.owner_id = auth.uid() or public.is_admin_user()),
           (select count(*) from public.sponsor_events e where e.target_kind = p.target_kind and e.target_id = p.target_id and e.kind = 'view' and e.created_at >= p.created_at),
           (select count(*) from public.sponsor_events e where e.target_kind = p.target_kind and e.target_id = p.target_id and e.sponsor_id = l.id and e.kind = 'click'),
           (select count(*) from public.sponsor_events e where e.target_kind = p.target_kind and e.target_id = p.target_id and e.sponsor_id = l.id and e.kind = 'commercial')
      from public.sponsor_placements p join public.sponsor_library l on l.id = p.sponsor_id
     where p.target_kind = p_kind and p.target_id = p_target
     order by case p.level when 'title' then 0 when 'gold' then 1 else 2 end, p.created_at;
end $$;
revoke all on function public.get_target_sponsors_admin(text, uuid) from public, anon;
grant execute on function public.get_target_sponsors_admin(text, uuid) to authenticated;

-- The sponsor owner's report across everything their sponsors are placed on.
create or replace function public.my_sponsor_report()
returns table (sponsor_id uuid, placement_id uuid, target_kind text, target_id uuid, target_title text, level text,
               amount_cents int, with_commercial boolean, views bigint, clicks bigint, commercials bigint)
language sql stable security definer set search_path to 'public' as $$
  select l.id, p.id, p.target_kind, p.target_id,
         case p.target_kind
           when 'trivia'  then (select t.title from public.trivia_packs t where t.id = p.target_id)
           when 'vote'    then (select e.title from public.live_vote_events e where e.id = p.target_id)
           when 'bracket' then (select s.title from public.pred_slates s where s.id = p.target_id)
           when 'bout'    then (select b.title from public.bouts b where b.id = p.target_id)
         end,
         p.level, p.amount_cents, p.with_commercial,
         (select count(*) from public.sponsor_events e where e.target_kind = p.target_kind and e.target_id = p.target_id and e.kind = 'view' and e.created_at >= p.created_at),
         (select count(*) from public.sponsor_events e where e.target_kind = p.target_kind and e.target_id = p.target_id and e.sponsor_id = l.id and e.kind = 'click'),
         (select count(*) from public.sponsor_events e where e.target_kind = p.target_kind and e.target_id = p.target_id and e.sponsor_id = l.id and e.kind = 'commercial')
    from public.sponsor_library l join public.sponsor_placements p on p.sponsor_id = l.id
   where l.owner_id = auth.uid()
   order by p.created_at desc
$$;
revoke all on function public.my_sponsor_report() from public, anon;
grant execute on function public.my_sponsor_report() to authenticated;

-- Counting: a view (once per visitor session), a tap on a logo, or a commercial being shown.
create or replace function public.log_sponsor_event(p_kind text, p_target_kind text, p_target uuid, p_sponsor uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_kind not in ('view','click','commercial') then return; end if;
  if not exists (select 1 from public.sponsor_placements where target_kind = p_target_kind and target_id = p_target
                 and (p_sponsor is null or sponsor_id = p_sponsor)) then return; end if;
  if (select count(*) from public.sponsor_events where target_kind = p_target_kind and target_id = p_target and created_at > now() - interval '1 minute') >= 600 then return; end if;
  insert into public.sponsor_events (sponsor_id, target_kind, target_id, kind) values (p_sponsor, p_target_kind, p_target, p_kind);
end $$;
grant execute on function public.log_sponsor_event(text, text, uuid, uuid) to anon, authenticated;

-- ===== Trivia: show placements, and let the host run a sponsor commercial break =====
alter table public.trivia_games add column if not exists break_sponsor uuid;

create or replace function public.trivia_set_break(p_game uuid, p_sponsor uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare g public.trivia_games;
begin
  g := (select z from public.trivia_games z where id = p_game);
  if g.id is null or (g.host_id <> auth.uid() and not public.is_admin_user()) then raise exception 'Not your game'; end if;
  if p_sponsor is null then
    update public.trivia_games set break_sponsor = null where id = g.id;
    return;
  end if;
  if not exists (select 1 from public.sponsor_placements p join public.sponsor_library l on l.id = p.sponsor_id
                  where p.target_kind = 'trivia' and p.target_id = g.pack_id and p.sponsor_id = p_sponsor
                    and p.with_commercial and l.commercial_url is not null) then
    raise exception 'That sponsor has no commercial on this pack';
  end if;
  update public.trivia_games set break_sponsor = p_sponsor where id = g.id;
  insert into public.sponsor_events (sponsor_id, target_kind, target_id, kind) values (p_sponsor, 'trivia', g.pack_id, 'commercial');
end $$;
revoke all on function public.trivia_set_break(uuid, uuid) from public, anon;
grant execute on function public.trivia_set_break(uuid, uuid) to authenticated;

drop table if exists public.trivia_sponsors cascade;
drop function if exists public.trivia_sponsor_guard();

create or replace function public.trivia_state(p_code text, p_token text default null::text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions; pk public.trivia_packs; total int; spons json; brk json;
        show boolean; counts json; board json; teams json; mine json; qj json; remain numeric; hide int[] := '{}'; i int;
begin
  g := (select z from public.trivia_games z where code = upper(trim(p_code)));
  if g.id is null then return null; end if;
  pk := (select z from public.trivia_packs z where id = g.pack_id);
  spons := (select coalesce(json_agg(s order by s.ord), '[]'::json) from (
    select l.id, l.name, l.logo_url as logo, l.link_url as link, p.level,
           (p.with_commercial and l.commercial_url is not null) as commercial,
           case p.level when 'title' then 0 when 'gold' then 1 else 2 end as ord
    from public.sponsor_placements p join public.sponsor_library l on l.id = p.sponsor_id
    where p.target_kind = 'trivia' and p.target_id = g.pack_id order by ord, p.created_at limit 12) s);
  if g.break_sponsor is not null then
    brk := (select json_build_object('id', l.id, 'name', l.name, 'logo', l.logo_url, 'url', l.commercial_url, 'kind', l.commercial_kind)
            from public.sponsor_placements p join public.sponsor_library l on l.id = p.sponsor_id
            where p.target_kind = 'trivia' and p.target_id = g.pack_id and p.sponsor_id = g.break_sponsor and p.with_commercial and l.commercial_url is not null);
  end if;
  total := (select count(*) from public.trivia_questions where pack_id = g.pack_id);
  if g.question_limit is not null then total := least(total, g.question_limit); end if;
  if p_token is not null then pl := (select z from public.trivia_players z where game_id = g.id and token = p_token); end if;

  if g.current_pos >= 0 and g.status in ('question','reveal') then
    q := public.trivia_question_at(g, g.current_pos);
    show := g.status = 'reveal';
    remain := greatest(0, q.seconds - extract(epoch from (now() - g.q_started_at)));
    counts := (select coalesce(json_object_agg(choice, n), '{}'::json)
      from (select choice, count(*) n from public.trivia_answers where question_id = q.id and game_id = g.id group by choice) c);
    if pl.id is not null and pl.hint_qid = q.id and q.correct_index is not null then
      for i in 0..jsonb_array_length(q.options) - 1 loop
        if i <> q.correct_index and coalesce(array_length(hide, 1), 0) < 2 then hide := hide || i; end if;
      end loop;
    end if;
    qj := json_build_object('pos', g.current_pos, 'kind', q.kind, 'prompt', q.prompt, 'options', q.options,
      'seconds', q.seconds, 'points', q.points, 'remaining', remain, 'hide', hide,
      'correct', case when show then q.correct_index else null end,
      'explanation', case when show then q.explanation else null end,
      'counts', counts, 'needsOutcome', (q.kind = 'predict' and q.correct_index is null));
    if pl.id is not null then
      mine := (select json_build_object('choice', a.choice, 'points', a.points, 'doubled', a.doubled)
        from public.trivia_answers a where a.player_id = pl.id and a.question_id = q.id);
    end if;
  end if;

  board := (select coalesce(json_agg(r), '[]'::json) from (
    select name, team, score from public.trivia_players where game_id = g.id order by score desc, created_at limit 15) r);
  teams := (select json_build_object(
    'a', coalesce(sum(score) filter (where team = 'a'), 0), 'b', coalesce(sum(score) filter (where team = 'b'), 0),
    'na', count(*) filter (where team = 'a'), 'nb', count(*) filter (where team = 'b'))
    from public.trivia_players where game_id = g.id);

  return json_build_object(
    'game', json_build_object('id', g.id, 'code', g.code, 'title', g.title, 'mode', g.mode, 'teamA', g.team_a, 'teamB', g.team_b,
      'status', g.status, 'pos', g.current_pos, 'total', total, 'packId', g.pack_id),
    'brand', json_build_object('name', pk.brand_name, 'logo', pk.brand_logo_url, 'color', pk.brand_color,
      'bg', pk.brand_bg_color, 'image', pk.brand_bg_image_url, 'opacity', coalesce(pk.screen_bg_opacity, 100)),
    'sponsors', spons, 'break', brk,
    'question', qj, 'board', board, 'teams', teams, 'mine', mine,
    'me', case when pl.id is null then null else json_build_object('id', pl.id, 'name', pl.name, 'team', pl.team, 'score', pl.score,
        'doubleUsed', pl.double_used and pl.double_qid is distinct from (q).id, 'hintUsed', pl.hint_used and pl.hint_qid is distinct from (q).id,
        'rank', (select count(*) + 1 from public.trivia_players x where x.game_id = g.id and x.score > pl.score)) end,
    'players', (select count(*) from public.trivia_players where game_id = g.id));
end $function$;
