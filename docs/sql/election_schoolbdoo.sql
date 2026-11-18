-- BoutCasts School Election: School-B-Doo link.
-- An election created from a School-B-Doo handoff remembers which School-B-Doo school it belongs to, so
-- School-B-Doo can show students their own code and the results. Safe to run more than once.
alter table public.school_elections add column if not exists sbd_school_id text check (sbd_school_id is null or char_length(sbd_school_id) <= 40);
create index if not exists school_elections_sbd_idx on public.school_elections (sbd_school_id) where sbd_school_id is not null;
-- election_voters.student_ref (already there) holds the School-B-Doo member id for imported students.
