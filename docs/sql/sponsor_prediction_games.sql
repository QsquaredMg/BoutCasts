-- Sponsors on every prediction bracket (free ones too, any status) and on single prediction games.
-- Run once in the Supabase SQL editor. Safe to re-run. Needs sponsor_library.sql first.
alter table public.sponsor_placements drop constraint if exists sponsor_placements_target_kind_check;
alter table public.sponsor_placements add constraint sponsor_placements_target_kind_check
  check (target_kind in ('trivia','vote','bracket','bout','game'));

create or replace function public.sponsor_can_manage_target(p_kind text, p_target uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case p_kind
    when 'trivia'  then exists (select 1 from public.trivia_packs t where t.id = p_target and (t.owner_id = auth.uid() or public.is_admin_user()))
    when 'vote'    then (public.live_vote_can_moderate(p_target)
                         and (public.is_admin_user() or exists (select 1 from public.live_vote_events e where e.id = p_target and e.tier <> 'free')))
    when 'bracket' then exists (select 1 from public.pred_slates s where s.id = p_target and (s.created_by = auth.uid() or public.pred_is_admin()))
    when 'game'    then exists (select 1 from public.pred_games g where g.id = p_target and (g.created_by = auth.uid() or public.pred_is_admin()))
    when 'bout'    then public.is_admin_user()
    else false end
$$;
revoke all on function public.sponsor_can_manage_target(text, uuid) from public, anon;
grant execute on function public.sponsor_can_manage_target(text, uuid) to authenticated;

create or replace function public.my_sponsor_report()
returns table (sponsor_id uuid, placement_id uuid, target_kind text, target_id uuid, target_title text, level text,
               amount_cents int, with_commercial boolean, views bigint, clicks bigint, commercials bigint)
language sql stable security definer set search_path to 'public' as $$
  select l.id, p.id, p.target_kind, p.target_id,
         case p.target_kind
           when 'trivia'  then (select t.title from public.trivia_packs t where t.id = p.target_id)
           when 'vote'    then (select e.title from public.live_vote_events e where e.id = p.target_id)
           when 'bracket' then (select s.title from public.pred_slates s where s.id = p.target_id)
           when 'game'    then (select g.home_name || ' vs ' || g.away_name from public.pred_games g where g.id = p.target_id)
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
