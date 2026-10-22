-- Pin the search_path on election_norm_name (Supabase advisor: function_search_path_mutable).
-- Already run in prod.
alter function public.election_norm_name(text) set search_path = public;
