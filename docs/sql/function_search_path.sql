-- Pin the search_path on the 7 functions Supabase flagged as "mutable".
-- Safe: none of them are SECURITY DEFINER and none call extension functions.
-- Run in the Supabase SQL editor.
alter function public.guest_daily_limit() set search_path = public, pg_temp;
alter function public.paid_bout_net_after_fee(integer, integer) set search_path = public, pg_temp;
alter function public.paid_bouts_guard() set search_path = public, pg_temp;
alter function public.pred_lock_grace() set search_path = public, pg_temp;
alter function public.trivia_new_code() set search_path = public, pg_temp;
alter function public.trivia_pack_guard() set search_path = public, pg_temp;
alter function public.trivia_question_touch() set search_path = public, pg_temp;
