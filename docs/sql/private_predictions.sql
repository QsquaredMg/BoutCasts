-- Private (closed, invite-only) prediction games. $5 per game, paid by the creator; invitees play free.
-- Private games skip the "same game already exists" check entirely (their dup_key is unique), and public
-- duplicate checks never see them. Hidden from public lists and the public leaderboards.

alter table pred_slates add column if not exists visibility text not null default 'public';
alter table pred_slates add column if not exists invite_code text;
alter table pred_games  add column if not exists is_private boolean not null default false;

alter table pred_slates drop constraint if exists pred_slates_tier_check;
alter table pred_slates add constraint pred_slates_tier_check check (tier = any (array['weekly','season','private']));
alter table pred_slates drop constraint if exists pred_slates_visibility_check;
alter table pred_slates add constraint pred_slates_visibility_check check (visibility in ('public','private'));
create unique index if not exists pred_slates_invite_code_key on pred_slates (invite_code) where invite_code is not null;

-- Create a private game room (1-20 games). Returns the draft id; the app then starts Stripe checkout ($5 x games).
create or replace function create_pred_private(p_title text, p_games jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); sid uuid; n int; i int; ga jsonb; st timestamptz; code text; tries int := 0;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if btrim(coalesce(p_title,'')) = '' or char_length(btrim(p_title)) not between 3 and 80 then
    raise exception 'Give your private game a name (3 to 80 characters)';
  end if;
  if (select count(*) from pred_slates where created_by = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Slow down: too many games started today';
  end if;
  n := coalesce(jsonb_array_length(p_games), 0);
  if n < 1 or n > 20 then raise exception 'Add between 1 and 20 games'; end if;
  for i in 1..n loop
    ga := p_games -> (i-1);
    if btrim(coalesce(ga ->> 'home_name','')) = '' or btrim(coalesce(ga ->> 'away_name','')) = ''
       or char_length(btrim(ga ->> 'home_name')) > 40 or char_length(btrim(ga ->> 'away_name')) > 40 then
      raise exception 'Game % needs two team names (40 characters max)', i;
    end if;
    if lower(btrim(ga ->> 'home_name')) = lower(btrim(ga ->> 'away_name')) then raise exception 'Game % needs two different teams', i; end if;
    st := (ga ->> 'starts_at')::timestamptz;
    if st is null or st <= now() + interval '1 minute' then raise exception 'Game % needs a start time in the future', i; end if;
    if st > now() + interval '1 year' then raise exception 'Game % starts too far away', i; end if;
  end loop;

  loop
    code := '';
    for i in 1..6 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from pred_slates where invite_code = code);
    tries := tries + 1;
    if tries > 20 then raise exception 'Could not make an invite code, try again'; end if;
  end loop;

  insert into pred_slates(title, created_by, kind, tier, status, visibility, invite_code)
  values (btrim(p_title), uid, 'slate', 'private', 'pending', 'private', code) returning id into sid;
  for i in 1..n loop
    ga := p_games -> (i-1);
    insert into pred_games(id, slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, allow_draw, dup_key, is_private)
    select g, sid, uid, btrim(ga ->> 'home_name'), nullif(btrim(coalesce(ga ->> 'home_logo','')),''),
           btrim(ga ->> 'away_name'), nullif(btrim(coalesce(ga ->> 'away_logo','')),''),
           (ga ->> 'starts_at')::timestamptz, coalesce((ga ->> 'allow_draw')::boolean, false), 'private|' || g::text, true
      from (select gen_random_uuid() g) x;
  end loop;
  return jsonb_build_object('ok', true, 'id', sid, 'code', code, 'games', n);
end $$;
revoke all on function create_pred_private(text, jsonb) from public, anon;
grant execute on function create_pred_private(text, jsonb) to authenticated;

-- Look up a private game room by its 6-letter code (paid and open only).
create or replace function pred_slate_by_code(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from pred_slates
   where invite_code = upper(btrim(p_code)) and visibility = 'private' and status = 'open' limit 1
$$;
grant execute on function pred_slate_by_code(text) to anon, authenticated;

-- Public leaderboards leave private games out; a private room's own board (p_slate) still works.
create or replace function pred_leaderboard(p_scope text, p_slate uuid default null, p_limit integer default 25)
returns table(user_id uuid, username text, avatar_url text, points bigint, games bigint, winners bigint, perfect bigint)
language sql stable security definer set search_path = public as $$
  with pts as (
    select p.user_id, p.pts_total, p.pts_winner, p.pts_exact, g.slate_id, g.starts_at, g.is_private
      from pred_predictions p join pred_games g on g.id = p.game_id
     where p.graded_at is not null and g.status = 'final'
    union all
    select b.user_id, b.pts_total, b.pts_winner, b.pts_exact, g.slate_id, g.starts_at, g.is_private
      from pred_bracket_picks b join pred_games g on g.id = b.game_id
     where b.graded_at is not null and g.status = 'final'
  )
  select x.user_id, pr.username, pr.avatar_url, sum(x.pts_total)::bigint, count(*)::bigint,
         count(*) filter (where x.pts_winner > 0)::bigint, count(*) filter (where x.pts_exact = 6)::bigint
    from pts x
    left join profiles pr on pr.id = x.user_id
   where case
           when p_slate is not null then x.slate_id = p_slate
           when p_scope = 'week' then x.starts_at >= now() - interval '7 days' and not x.is_private
           else x.starts_at >= date_trunc('year', now()) and not x.is_private
         end
   group by x.user_id, pr.username, pr.avatar_url
   order by 4 desc, 7 desc, 6 desc, 5 desc, pr.username
   limit least(greatest(p_limit,1),100)
$$;

-- Admins can open a private room for free without turning it into a public-tier bracket.
create or replace function admin_open_pred_bracket(p_id uuid, p_tier text default 'season')
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if not pred_is_admin() then raise exception 'Admins only'; end if;
  ok := activate_pred_bracket(p_id, 'admin-comp-' || gen_random_uuid()::text,
          case when p_tier = 'weekly' then 'weekly' when p_tier = 'private' then 'private' else 'season' end);
  return ok;
end $$;
