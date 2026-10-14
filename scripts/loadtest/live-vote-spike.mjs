#!/usr/bin/env node
// Stadium-style vote spike against a Live Vote event. Run it against a TEST event on a staging
// project, never a real event on production.
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=... EVENT_ID=<uuid> \
//   SITE_URL=https://staging.example.com VOTERS=2000 RAMP_SECONDS=20 node scripts/loadtest/live-vote-spike.mjs
//
// Each simulated phone: loads the event, casts one vote with its own voter token, then polls the
// cached tally route every 3 seconds until the run ends. Reports p50/p95/p99 and error counts.
// The test event must be open_link mode with a tier cap above VOTERS (use "large", 50,000).

const { SUPABASE_URL, SUPABASE_ANON_KEY, EVENT_ID, SITE_URL } = process.env;
const VOTERS = Number(process.env.VOTERS ?? 1000);
const RAMP = Number(process.env.RAMP_SECONDS ?? 10);
const HOLD = Number(process.env.HOLD_SECONDS ?? 30);
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EVENT_ID || !SITE_URL) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY, EVENT_ID and SITE_URL.");
  process.exit(1);
}
if (/boutcasts\.com/i.test(SITE_URL) && process.env.I_UNDERSTAND_THIS_IS_PRODUCTION !== "yes") {
  console.error("Refusing to load-test production. Point SITE_URL at a staging deployment.");
  process.exit(1);
}

const H = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" };
const stats = { vote: [], tally: [], voteErr: {}, tallyErr: {} };
const bump = (o, k) => (o[k] = (o[k] ?? 0) + 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => (a.length ? a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0);

async function timed(bucket, errs, fn) {
  const t = performance.now();
  try {
    const res = await fn();
    bucket.push(performance.now() - t);
    if (!res.ok && res.status !== 409) bump(errs, res.status);
    return res;
  } catch (e) {
    bucket.push(performance.now() - t);
    bump(errs, e.code ?? "network");
  }
}

const options = await (await fetch(`${SUPABASE_URL}/rest/v1/live_vote_options?event_id=eq.${EVENT_ID}&select=id`, { headers: H })).json();
if (!Array.isArray(options) || options.length < 2) {
  console.error("Could not read the event's options. Is EVENT_ID right and the event public?");
  process.exit(1);
}

const endAt = Date.now() + (RAMP + HOLD) * 1000;
async function phone(i) {
  await sleep((i / VOTERS) * RAMP * 1000 + Math.random() * 500);
  const token = crypto.randomUUID();
  const opt = options[Math.floor(Math.random() * options.length)].id;
  await timed(stats.vote, stats.voteErr, () =>
    fetch(`${SUPABASE_URL}/rest/v1/live_votes`, {
      method: "POST",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ event_id: EVENT_ID, option_id: opt, voter_token: token }),
    }),
  );
  while (Date.now() < endAt) {
    await timed(stats.tally, stats.tallyErr, () => fetch(`${SITE_URL}/api/live-vote/${EVENT_ID}/tally`));
    await sleep(3000 + Math.random() * 500);
  }
}

console.log(`Ramping ${VOTERS} phones over ${RAMP}s, holding ${HOLD}s...`);
await Promise.all(Array.from({ length: VOTERS }, (_, i) => phone(i)));

const row = (name, a, errs) =>
  console.log(`${name.padEnd(8)} n=${String(a.length).padEnd(7)} p50=${pct(a, 50).toFixed(0)}ms p95=${pct(a, 95).toFixed(0)}ms p99=${pct(a, 99).toFixed(0)}ms errors=${JSON.stringify(errs)}`);
row("vote", stats.vote, stats.voteErr);
row("tally", stats.tally, stats.tallyErr);
console.log("Pass bar: vote p95 < 1000ms, tally p95 < 500ms, errors < 1%.");
