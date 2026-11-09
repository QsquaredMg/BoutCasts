-- Stadium trivia: the host chooses how many questions a live game uses, and whether they are the first N in order or a random pick.
-- Run once in the Supabase SQL editor. Safe to re-run. null = use every question in the pack (as before).
alter table public.trivia_games add column if not exists question_limit int check (question_limit is null or question_limit between 1 and 200);
-- When the host asks for a random pick, the chosen questions are fixed at creation, in play order. null = pack order.
alter table public.trivia_games add column if not exists question_ids uuid[];

-- The question being played at a position: from the random list when there is one, otherwise pack order.
create or replace function public.trivia_question_at(g public.trivia_games, p_pos int)
returns public.trivia_questions
language sql
stable
security definer
set search_path to 'public'
as $$
  select z.* from public.trivia_questions z
  where z.pack_id = g.pack_id and (g.question_ids is null or z.id = g.question_ids[p_pos + 1])
  order by z.position, z.created_at
  offset case when g.question_ids is null then p_pos else 0 end
  limit 1;
$$;

-- Replace the 4-argument version so there is only one trivia_create_game.
drop function if exists public.trivia_create_game(uuid, text, text, text);
drop function if exists public.trivia_create_game(uuid, text, text, text, int);
create or replace function public.trivia_create_game(p_pack uuid, p_mode text, p_team_a text, p_team_b text, p_limit int default null, p_random boolean default false)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare pk public.trivia_packs; c text; n int; lim int; ids uuid[];
begin
  if auth.uid() is null then raise exception 'Sign in to host'; end if;
  pk := (select z from public.trivia_packs z where id = p_pack);
  if pk.id is null or (pk.owner_id <> auth.uid() and not public.is_admin_user()) then raise exception 'Pack not found'; end if;
  if pk.status <> 'approved' then raise exception 'Approve the pack before going live'; end if;
  n := (select count(*) from public.trivia_questions where pack_id = p_pack);
  if p_limit is not null and p_limit < 1 then raise exception 'Choose at least 1 question'; end if;
  -- Asking for more than the pack holds just uses the whole pack.
  lim := case when p_limit is null or p_limit >= n then null else p_limit end;
  if coalesce(p_random, false) then
    ids := array(select id from public.trivia_questions where pack_id = p_pack order by random() limit coalesce(lim, n));
  end if;
  c := public.trivia_new_code();
  insert into public.trivia_games(pack_id, host_id, code, title, mode, team_a, team_b, question_limit, question_ids)
  values (p_pack, auth.uid(), c, pk.title, case when p_mode = 'team' then 'team' else 'solo' end,
          coalesce(nullif(left(trim(p_team_a), 24), ''), 'Team A'), coalesce(nullif(left(trim(p_team_b), 24), ''), 'Team B'), lim, ids);
  return c;
end $function$;

-- Host actions: the game ends after the chosen number of questions.
create or replace function public.trivia_host_action(p_game uuid, p_action text, p_outcome integer default null::integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare g public.trivia_games; q public.trivia_questions; total int; nxt int;
begin
  g := (select z from public.trivia_games z where id = p_game);
  if g.id is null or (g.host_id <> auth.uid() and not public.is_admin_user()) then raise exception 'Not your game'; end if;
  total := (select count(*) from public.trivia_questions where pack_id = g.pack_id);
  if g.question_limit is not null then total := least(total, g.question_limit); end if;

  if p_action in ('start','next') then
    nxt := g.current_pos + 1;
    if nxt >= total then
      update public.trivia_games set status = 'done' where id = g.id;
    else
      update public.trivia_games set status = 'question', current_pos = nxt, q_started_at = now() where id = g.id;
    end if;
  elsif p_action = 'reveal' then
    if g.status <> 'question' then return; end if;
    q := public.trivia_question_at(g, g.current_pos);
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
end $function$;

-- Game state: report the chosen number of questions as the total.
create or replace function public.trivia_state(p_code text, p_token text default null::text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions; total int;
        show boolean; counts json; board json; teams json; mine json; qj json; remain numeric; hide int[] := '{}'; i int;
begin
  g := (select z from public.trivia_games z where code = upper(trim(p_code)));
  if g.id is null then return null; end if;
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
      'status', g.status, 'pos', g.current_pos, 'total', total),
    'question', qj, 'board', board, 'teams', teams, 'mine', mine,
    'me', case when pl.id is null then null else json_build_object('id', pl.id, 'name', pl.name, 'team', pl.team, 'score', pl.score,
        'doubleUsed', pl.double_used and pl.double_qid is distinct from (q).id, 'hintUsed', pl.hint_used and pl.hint_qid is distinct from (q).id,
        'rank', (select count(*) + 1 from public.trivia_players x where x.game_id = g.id and x.score > pl.score)) end,
    'players', (select count(*) from public.trivia_players where game_id = g.id));
end $function$;

-- Answers and hints read the same question as everyone else.
create or replace function public.trivia_answer(p_code text, p_token text, p_choice integer, p_double boolean default false)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions;
        remain numeric; pts int := 0; dbl boolean := false;
begin
  g := (select z from public.trivia_games z where code = upper(trim(p_code)));
  pl := (select z from public.trivia_players z where game_id = g.id and token = p_token);
  if g.id is null or pl.id is null then raise exception 'Join the game first'; end if;
  if g.status <> 'question' then raise exception 'Answers are closed'; end if;
  q := public.trivia_question_at(g, g.current_pos);
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
end $function$;

create or replace function public.trivia_hint(p_code text, p_token text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions; hide int[] := '{}'; i int;
begin
  g := (select z from public.trivia_games z where code = upper(trim(p_code)));
  pl := (select z from public.trivia_players z where game_id = g.id and token = p_token);
  if g.id is null or pl.id is null or g.status <> 'question' then raise exception 'Not available'; end if;
  q := public.trivia_question_at(g, g.current_pos);
  if q.kind <> 'mc' or q.correct_index is null then raise exception 'No hints on this question'; end if;
  if pl.hint_used and pl.hint_qid is distinct from q.id then raise exception 'Hint already used'; end if;
  update public.trivia_players set hint_used = true, hint_qid = q.id where id = pl.id;
  for i in 0..jsonb_array_length(q.options) - 1 loop
    if i <> q.correct_index and coalesce(array_length(hide, 1), 0) < 2 then hide := hide || i; end if;
  end loop;
  return json_build_object('hide', hide);
end $function$;
