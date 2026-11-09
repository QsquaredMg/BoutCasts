-- Jumbotron / big-screen background: how strongly the event's background photo shows over its background color.
-- Run once in the Supabase SQL editor. Safe to re-run. 100 = photo at full strength (the default), 0 = color only.
alter table public.live_vote_events add column if not exists screen_bg_opacity int not null default 100 check (screen_bg_opacity between 0 and 100);

create or replace function public.set_live_vote_screen_look(p_event_id uuid, p_opacity int)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_opacity is null or p_opacity < 0 or p_opacity > 100 then raise exception 'Opacity must be 0 to 100'; end if;
  if not exists (
    select 1 from public.live_vote_events e
    where e.id = p_event_id and (e.organizer_id = auth.uid() or public.live_vote_can_moderate(e.id) or public.is_admin_user())
  ) then raise exception 'Not your event'; end if;
  update public.live_vote_events set screen_bg_opacity = p_opacity where id = p_event_id;
end $function$;
revoke all on function public.set_live_vote_screen_look(uuid, int) from public, anon;
grant execute on function public.set_live_vote_screen_look(uuid, int) to authenticated;
