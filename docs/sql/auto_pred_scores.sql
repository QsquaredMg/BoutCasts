-- Automatic final scores for admin-created prediction games.
-- The scheduled job (/api/cron/pred-scores) looks up finished games and calls this
-- server-only function, which scores the game exactly like the manual "Submit final
-- score" button (same grading, same bracket advancing).
-- Run once in the Supabase SQL editor.

create or replace function public.auto_finalize_pred_game(p_game uuid, p_home integer, p_away integer)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  g pred_games;
begin
  select * into g from pred_games where id = p_game;
  if not found then raise exception 'Game not found'; end if;
  if g.status <> 'scheduled' then raise exception 'This game is not waiting for a score'; end if;
  if not coalesce((select is_admin from profiles where id = g.created_by), false) then
    raise exception 'Only admin-created games are scored automatically';
  end if;
  -- act as the admin who created the game, so the normal scoring function accepts the call
  perform set_config('request.jwt.claim.sub', g.created_by::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', g.created_by, 'role', 'authenticated')::text, true);
  perform public.finalize_pred_game(p_game, p_home, p_away);
end
$fn$;

revoke all on function public.auto_finalize_pred_game(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.auto_finalize_pred_game(uuid, integer, integer) to service_role;
