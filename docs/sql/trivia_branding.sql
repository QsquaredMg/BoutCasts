-- Branded live trivia: a pack can carry a name, logo, colors and a background photo that show on the big screen and on players' phones.
-- Run once in the Supabase SQL editor. Safe to re-run. All columns are optional; blank = the standard BoutCasts trivia look.
alter table public.trivia_packs add column if not exists brand_name text check (brand_name is null or char_length(brand_name) <= 60);
alter table public.trivia_packs add column if not exists brand_logo_url text check (brand_logo_url is null or (char_length(brand_logo_url) <= 500 and brand_logo_url ~ '^https://[^\s"''()<>]+$'));
alter table public.trivia_packs add column if not exists brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.trivia_packs add column if not exists brand_bg_color text check (brand_bg_color is null or brand_bg_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.trivia_packs add column if not exists brand_bg_image_url text check (brand_bg_image_url is null or (char_length(brand_bg_image_url) <= 500 and brand_bg_image_url ~ '^https://[^\s"''()<>]+$'));
alter table public.trivia_packs add column if not exists screen_bg_opacity int not null default 100 check (screen_bg_opacity between 0 and 100);

-- Game state now also reports the pack's look (null fields = default).
create or replace function public.trivia_state(p_code text, p_token text default null::text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare g public.trivia_games; pl public.trivia_players; q public.trivia_questions; pk public.trivia_packs; total int;
        show boolean; counts json; board json; teams json; mine json; qj json; remain numeric; hide int[] := '{}'; i int;
begin
  g := (select z from public.trivia_games z where code = upper(trim(p_code)));
  if g.id is null then return null; end if;
  pk := (select z from public.trivia_packs z where id = g.pack_id);
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
    'brand', json_build_object('name', pk.brand_name, 'logo', pk.brand_logo_url, 'color', pk.brand_color,
      'bg', pk.brand_bg_color, 'image', pk.brand_bg_image_url, 'opacity', coalesce(pk.screen_bg_opacity, 100)),
    'question', qj, 'board', board, 'teams', teams, 'mine', mine,
    'me', case when pl.id is null then null else json_build_object('id', pl.id, 'name', pl.name, 'team', pl.team, 'score', pl.score,
        'doubleUsed', pl.double_used and pl.double_qid is distinct from (q).id, 'hintUsed', pl.hint_used and pl.hint_qid is distinct from (q).id,
        'rank', (select count(*) + 1 from public.trivia_players x where x.game_id = g.id and x.score > pl.score)) end,
    'players', (select count(*) from public.trivia_players where game_id = g.id));
end $function$;
