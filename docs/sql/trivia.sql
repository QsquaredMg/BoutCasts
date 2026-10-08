-- BoutCasts Live Trivia
-- Additive and idempotent. Run in the Supabase SQL editor.
--
-- Model:
--   trivia_packs      question sets written by organizers/admins, or drafted by AI and reviewed
--   trivia_questions  kind: mc (multiple choice) | stump (crowd vs the truth) | predict (real-world outcome)
--   trivia_games      one live session: join code, solo or team mode, current question + timer
--   trivia_players    anonymous (token) or signed-in players, optional team a/b
--   trivia_answers    one answer per player per question
--
-- Safety gate: a pack can only be run once status = 'approved', and it can only become
-- approved when every question is marked reviewed. Editing an approved pack sends it
-- back to 'draft' so AI text is never live without a human look.
-- Players never read tables directly; everything goes through security-definer RPCs.

create table if not exists public.trivia_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 500),
  source text not null default 'manual' check (source in ('manual','ai')),
  ai_topic text,
  status text not null default 'draft' check (status in ('draft','review','approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.trivia_packs(id) on delete cascade,
  position int not null default 0,
  kind text not null default 'mc' check (kind in ('mc','stump','predict')),
  prompt text not null check (char_length(prompt) between 3 and 400),
  options jsonb not null default '[]'::jsonb,
  correct_index int,
  explanation text check (char_length(explanation) <= 500),
  seconds int not null default 20 check (seconds between 5 and 120),
  points int not null default 100 check (points between 10 and 1000),
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  check (kind = 'predict' or correct_index is not null),
  check (correct_index is null or (correct_index >= 0 and correct_index < jsonb_array_length(options)))
);
create index if not exists trivia_questions_pack_idx on public.trivia_questions(pack_id, position);

create table if not exists public.trivia_games (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.trivia_packs(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  title text not null,
  mode text not null default 'solo' check (mode in ('solo','team')),
  team_a text not null default 'Team A',
  team_b text not null default 'Team B',
  status text not null default 'lobby' check (status in ('lobby','question','reveal','done')),
  current_pos int not null default -1,
  q_started_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists trivia_games_host_idx on public.trivia_games(host_id, created_at desc);

create table if not exists public.trivia_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.trivia_games(id) on delete cascade,
  token text not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 24),
  team text check (team in ('a','b')),
  score int not null default 0,
  double_qid uuid,
  double_used boolean not null default false,
  hint_qid uuid,
  hint_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, token)
);
create index if not exists trivia_players_game_idx on public.trivia_players(game_id, score desc);

create table if not exists public.trivia_answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.trivia_games(id) on delete cascade,
  question_id uuid not null references public.trivia_questions(id) on delete cascade,
  player_id uuid not null references public.trivia_players(id) on delete cascade,
  choice int not null check (choice between 0 and 3),
  doubled boolean not null default false,
  points int not null default 0,
  answered_at timestamptz not null default now(),
  unique (player_id, question_id)
);
create index if not exists trivia_answers_q_idx on public.trivia_answers(game_id, question_id);

alter table public.trivia_packs enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.trivia_games enable row level security;
alter table public.trivia_players enable row level security;
alter table public.trivia_answers enable row level security;

-- Authors manage their own packs; admins see everything.
drop policy if exists trivia_packs_rw on public.trivia_packs;
create policy trivia_packs_rw on public.trivia_packs for all to authenticated
  using (owner_id = auth.uid() or public.is_admin_user())
  with check (owner_id = auth.uid() or public.is_admin_user());

drop policy if exists trivia_questions_rw on public.trivia_questions;
create policy trivia_questions_rw on public.trivia_questions for all to authenticated
  using (exists (select 1 from public.trivia_packs p where p.id = pack_id and (p.owner_id = auth.uid() or public.is_admin_user())))
  with check (exists (select 1 from public.trivia_packs p where p.id = pack_id and (p.owner_id = auth.uid() or public.is_admin_user())));

-- Hosts can list their own games (players/answers are RPC-only).
drop policy if exists trivia_games_host_read on public.trivia_games;
create policy trivia_games_host_read on public.trivia_games for select to authenticated
  using (host_id = auth.uid() or public.is_admin_user());

-- ---------------------------------------------------------------- approval gate
create or replace function public.trivia_pack_guard() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    if exists (select 1 from public.trivia_questions q where q.pack_id = new.id and not q.reviewed)
       or not exists (select 1 from public.trivia_questions q where q.pack_id = new.id) then
      raise exception 'Review every question before approving this pack';
    end if;
    new.approved_at := now();
  end if;
  if new.status <> 'approved' then new.approved_at := null; end if;
  return new;
end $$;
drop trigger if exists trivia_pack_guard_t on public.trivia_packs;
create trigger trivia_pack_guard_t before insert or update on public.trivia_packs
  for each row execute function public.trivia_pack_guard();

create or replace function public.trivia_question_touch() returns trigger
language plpgsql as $$
declare pid uuid := coalesce(new.pack_id, old.pack_id);
begin
  update public.trivia_packs set status = 'draft' where id = pid and status = 'approved';
  return null;
end $$;
drop trigger if exists trivia_question_touch_t on public.trivia_questions;
create trigger trivia_question_touch_t after insert or update or delete on public.trivia_questions
  for each row execute function public.trivia_question_touch();

-- ---------------------------------------------------------------- helpers
create or replace function public.trivia_new_code() returns text
language plpgsql as $$
declare c text; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  loop
    c := '';
    for i in 1..5 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.trivia_games where code = c);
  end loop;
  return c;
end $$;

-- ---------------------------------------------------------------- RPCs
create or replace function public.trivia_create_game(p_pack uuid, p_mode text, p_team_a text, p_team_b text)
returns text language plpgsql security definer set search_path = public as $$
declare pk public.trivia_packs; c text;
begin
  if auth.uid() is null then raise exception 'Sign in to host'; end if;
  select * into pk from public.trivia_packs where id = p_pack;
  if pk.id is null or (pk.owner_id <> auth.uid() and not public.is_admin_user()) then raise exception 'Pack not found'; end if;
  if pk.status <> 'approved' then raise exception 'Approve the pack before going live'; end if;
  c := public.trivia_new_code();
  insert into public.trivia_games(pack_id, host_id, code, title, mode, team_a, team_b)
  values (p_pack, auth.uid(), c, pk.title, case when p_mode = 'team' then 'team' else 'solo' end,
          coalesce(nullif(left(trim(p_team_a), 24), ''), 'Team A'), coalesce(nullif(left(trim(p_team_b), 24), ''), 'Team B'));
  return c;
end $$;

create or replace function public.trivia_join(p_code text, p_name text, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare g public.trivia_games; pl public.trivia_players; t text; na int; nb int;
begin
  select * into g from public.trivia_games where code = upper(trim(p_code));
  if g.id is null then raise exception 'Game not found'; end if;
  if length(coalesce(p_token, '')) < 8 then raise exception 'Bad token'; end if;
  select * into pl from public.trivia_players where game_id = g.id and token = p_token;
  if pl.id is null then
    if g.status = 'done' then raise exception 'This game has ended'; end if;
    if g.mode = 'team' then
      select count(*) filter (where team = 'a'), count(*) filter (where team = 'b') into na, nb
        from public.trivia_players where game_id = g.id;
      t := case when na <= nb then 'a' else 'b' end;
    end if;
    insert into public.trivia_players(game_id, token, user_id, name, team)
    values (g.id, p_token, auth.uid(), left(trim(coalesce(nullif(trim(p_name), ''), 'Player')), 24), t)
    returning * into pl;
  end if;
  return json_build_object('id', pl.id, 'name', pl.name, 'team', pl.team);
end $$;

create or replace function public.trivia_host_action(p_game uuid, p_action text, p_outcome int default null)
returns void language plpgsql security definer set search_path = public as $$
declare g public.trivia_games; q public.trivia_questions; total int; nxt int;
begin
  select * into g from public.trivia_games where id = p_game;
  if g.id is null or (g.host_id <> auth.uid() and not public.is_admin_user()) then raise exception 'Not your game'; end if;
  select count(*) into total from public.trivia_questions where pack_id = g.pack_id;

  if p_action in ('start','next') then
    nxt := g.current_pos + 1;
    if nxt >= total then
      update public.trivia_games set status = 'done' where id = g.id;
    else
      update public.trivia_games set status = 'question', current_pos = nxt, q_started_at = now() where id = g.id;
    end if;
  elsif p_action = 'reveal' then
    if g.status <> 'question' then return; end if;
    select * into q from public.trivia_questions
      where pack_id = g.pack_id order by position, created_at offset g.current_pos limit 1;
    if q.kind = 'predict' then
      if q.correct_index is null then
        if p_outcome is null or p_outcome < 0 or p_outcome >= jsonb_array_length(q.options) then
          raise exception 'Pick the real outcome to reveal';
        end if;
        update public.trivia_questions set correct_index = p_outcome where id = q.id;
        q.correct_index := p_outcome;
      end if;
      update public.trivia_answers set points = case when choice = q.correct_index then q.points * (case when doubled then 2 else 1 end) else 0 end
        where game_id = g.id and question_id = q.id;
    end if;
    update public.trivia_players p set score = p.score + a.points
      from public.trivia_answers a where a.player_id = p.id and a.question_id = q.id and a.game_id = g.id;
    update public.trivia_games set status = 'reveal' where id = g.id;
  elsif p_action = 'end' then
    update public.trivia_games set status = 'done' where id = g.id;
  end if;
end $$;

create or replace function public.trivia_hint(p_code text, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions; hide int[] := '{}'; i int;
begin
  select * into g from public.trivia_games where code = upper(trim(p_code));
  select * into pl from public.trivia_players where game_id = g.id and token = p_token;
  if g.id is null or pl.id is null or g.status <> 'question' then raise exception 'Not available'; end if;
  select * into q from public.trivia_questions where pack_id = g.pack_id order by position, created_at offset g.current_pos limit 1;
  if q.kind <> 'mc' or q.correct_index is null then raise exception 'No hints on this question'; end if;
  if pl.hint_used and pl.hint_qid is distinct from q.id then raise exception 'Hint already used'; end if;
  update public.trivia_players set hint_used = true, hint_qid = q.id where id = pl.id;
  for i in 0..jsonb_array_length(q.options) - 1 loop
    if i <> q.correct_index and coalesce(array_length(hide, 1), 0) < 2 then hide := hide || i; end if;
  end loop;
  return json_build_object('hide', hide);
end $$;

create or replace function public.trivia_answer(p_code text, p_token text, p_choice int, p_double boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions;
        remain numeric; pts int := 0; dbl boolean := false;
begin
  select * into g from public.trivia_games where code = upper(trim(p_code));
  select * into pl from public.trivia_players where game_id = g.id and token = p_token;
  if g.id is null or pl.id is null then raise exception 'Join the game first'; end if;
  if g.status <> 'question' then raise exception 'Answers are closed'; end if;
  select * into q from public.trivia_questions where pack_id = g.pack_id order by position, created_at offset g.current_pos limit 1;
  if p_choice < 0 or p_choice >= jsonb_array_length(q.options) then raise exception 'Bad choice'; end if;
  remain := q.seconds - extract(epoch from (now() - g.q_started_at));
  if remain < -2 then raise exception 'Time is up'; end if;
  if exists (select 1 from public.trivia_answers where player_id = pl.id and question_id = q.id) then
    raise exception 'Already answered';
  end if;
  if p_double and (not pl.double_used or pl.double_qid = q.id) then
    dbl := true;
    update public.trivia_players set double_used = true, double_qid = q.id where id = pl.id;
  end if;
  if q.kind <> 'predict' and p_choice = q.correct_index then
    pts := round(q.points * (0.5 + 0.5 * greatest(0, least(1, remain / q.seconds))))::int * (case when dbl then 2 else 1 end);
  end if;
  insert into public.trivia_answers(game_id, question_id, player_id, choice, doubled, points)
  values (g.id, q.id, pl.id, p_choice, dbl, pts);
  return json_build_object('ok', true, 'doubled', dbl);
end $$;

create or replace function public.trivia_state(p_code text, p_token text default null)
returns json language plpgsql security definer set search_path = public as $$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions; total int;
        show boolean; counts json; board json; teams json; mine json; qj json; remain numeric; hide int[] := '{}'; i int;
begin
  select * into g from public.trivia_games where code = upper(trim(p_code));
  if g.id is null then return null; end if;
  select count(*) into total from public.trivia_questions where pack_id = g.pack_id;
  if p_token is not null then select * into pl from public.trivia_players where game_id = g.id and token = p_token; end if;

  if g.current_pos >= 0 and g.status in ('question','reveal') then
    select * into q from public.trivia_questions where pack_id = g.pack_id order by position, created_at offset g.current_pos limit 1;
    show := g.status = 'reveal';
    remain := greatest(0, q.seconds - extract(epoch from (now() - g.q_started_at)));
    select coalesce(json_object_agg(choice, n), '{}'::json) into counts
      from (select choice, count(*) n from public.trivia_answers where question_id = q.id and game_id = g.id group by choice) c;
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
      select json_build_object('choice', a.choice, 'points', a.points, 'doubled', a.doubled) into mine
        from public.trivia_answers a where a.player_id = pl.id and a.question_id = q.id;
    end if;
  end if;

  select coalesce(json_agg(r), '[]'::json) into board from (
    select name, team, score from public.trivia_players where game_id = g.id order by score desc, created_at limit 15) r;
  select json_build_object(
    'a', coalesce(sum(score) filter (where team = 'a'), 0), 'b', coalesce(sum(score) filter (where team = 'b'), 0),
    'na', count(*) filter (where team = 'a'), 'nb', count(*) filter (where team = 'b'))
    into teams from public.trivia_players where game_id = g.id;

  return json_build_object(
    'game', json_build_object('id', g.id, 'code', g.code, 'title', g.title, 'mode', g.mode, 'teamA', g.team_a, 'teamB', g.team_b,
      'status', g.status, 'pos', g.current_pos, 'total', total),
    'question', qj, 'board', board, 'teams', teams, 'mine', mine,
    'me', case when pl.id is null then null else json_build_object('id', pl.id, 'name', pl.name, 'team', pl.team, 'score', pl.score,
        'doubleUsed', pl.double_used and pl.double_qid is distinct from (q).id, 'hintUsed', pl.hint_used and pl.hint_qid is distinct from (q).id,
        'rank', (select count(*) + 1 from public.trivia_players x where x.game_id = g.id and x.score > pl.score)) end,
    'players', (select count(*) from public.trivia_players where game_id = g.id));
end $$;

grant execute on function public.trivia_create_game(uuid, text, text, text) to authenticated;
grant execute on function public.trivia_host_action(uuid, text, int) to authenticated;
grant execute on function public.trivia_join(text, text, text) to anon, authenticated;
grant execute on function public.trivia_hint(text, text) to anon, authenticated;
grant execute on function public.trivia_answer(text, text, int, boolean) to anon, authenticated;
grant execute on function public.trivia_state(text, text) to anon, authenticated;
