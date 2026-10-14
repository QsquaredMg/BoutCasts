-- The "admin edit anytime" update added 7 admin_* functions that signed-out
-- visitors could still call (each one refuses non-admins inside, but they
-- should not be reachable at all). Same lockdown the other admin functions got.
-- Run in the Supabase SQL editor.
revoke execute on function public.admin_delete_debate_topic(uuid) from public, anon;
revoke execute on function public.admin_delete_live_vote(uuid, boolean) from public, anon;
revoke execute on function public.admin_delete_pred(text, uuid, boolean) from public, anon;
revoke execute on function public.admin_update_live_vote(uuid, text, text, text, timestamp with time zone, boolean) from public, anon;
revoke execute on function public.admin_update_pred_game(uuid, text, text, timestamp with time zone, text) from public, anon;
revoke execute on function public.admin_update_pred_slate(uuid, text, timestamp with time zone, boolean) from public, anon;
revoke execute on function public.admin_update_showcase(uuid, text, text, text, timestamp with time zone, boolean) from public, anon;
