# Stadium-scale voting: what we found and what to do

Reviewed from the code and live database, not yet load-tested. Run `scripts/loadtest/live-vote-spike.mjs` against a staging copy before any big event.

## Fixed in this change
1. **Live tally fan-out.** Every vote was pushed to every phone through Realtime. 10,000 phones x 200 votes/second is millions of messages per second. Medium and large events now read one cached snapshot (`/api/live-vote/[id]/tally`, shared by the CDN for 3 seconds). Free and small events keep instant realtime.
2. **Per-phone database counting.** Each phone called `get_live_vote_tally` (counts every vote) every 10 seconds, and again after its own vote. Big events now share the cached snapshot, so the database does one count per few seconds, not thousands.
3. **Slow vote cap check.** `enforce_live_vote_cap` counted the event's votes on every insert with no index on `event_id`. Added `live_votes_event_id_idx` (in `docs/sql/streaks_and_rivalries.sql`).

## Known limits (not changed)
- **Matchup (bout) guest votes are not stadium-safe.** `cast_guest_bout_vote` allows one guest vote per network per bout and asks for a name and email. Stadium Wi-Fi and phone carriers put thousands of phones behind a few shared addresses, so most would be refused. For in-venue crowds use a **Live Vote event** (open link mode), which has no network limit.
- **Vote caps by tier:** free 25, small 500, medium 5,000, large 50,000. The cap check is not atomic, so a burst can overshoot slightly.
- **Supabase plan limits** (database connections, API requests per second, Realtime connections) are set by the plan. Check the plan before a 10,000+ person event and consider a temporary compute upgrade.
- **Vercel:** the tally route is cheap and cacheable. The vote itself goes straight to Supabase, not through Vercel.

## Before a big event
1. Create a staging Supabase project and a Vercel preview deployment. Copy the schema, create a "large" open-link test event.
2. `SUPABASE_URL=... SUPABASE_ANON_KEY=... EVENT_ID=... SITE_URL=<preview url> VOTERS=2000 node scripts/loadtest/live-vote-spike.mjs`, then raise VOTERS (5,000, 10,000). Run it from a machine with a good connection, or from several machines at once.
3. Pass bar: vote p95 under 1 second, tally p95 under 0.5 seconds, under 1% errors.
4. Watch Supabase's database and Realtime dashboards during the run.
