import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCaptions } from "./caption";
import { boutLaunch, paidBoutLaunch } from "./launchCaption";
import { findSchoolTags, schoolLines } from "./schools";
import type { SocialDraft, TopRow } from "./types";

const DAY = 24 * 60 * 60 * 1000;

const pct = (a: number, b: number) => (a + b ? Math.round((a / (a + b)) * 100) : 0);
const votes = (n: number) => `${n.toLocaleString()} vote${n === 1 ? "" : "s"}`;
const rows = (list: { name: string; score: string }[]): TopRow[] =>
  list.slice(0, 10).map((r, i) => ({ rank: i + 1, name: r.name, score: r.score }));

type Db = SupabaseClient;

async function boutDrafts(db: Db, since: string): Promise<SocialDraft[]> {
  const { data: bouts } = await db
    .from("bouts")
    .select("id, title, winner_side, competitor_a_name, competitor_b_name, competitor_a_submission_id, competitor_b_submission_id, bout_mode")
    .eq("status", "final")
    .is("deleted_at", null)
    .is("bracket_key", null)
    .not("winner_side", "is", null)
    .gte("closes_at", since)
    .limit(30);
  const out: SocialDraft[] = [];
  for (const b of bouts ?? []) {
    if (!b.competitor_a_submission_id || !b.competitor_b_submission_id) continue;
    const { data: v } = await db.from("votes").select("side").eq("bout_id", b.id);
    let ta = 0, tb = 0;
    for (const x of v ?? []) { if (x.side === "a") ta++; else tb++; }
    const aWon = b.winner_side === "a";
    const [wn, ln, wv, lv] = aWon ? [b.competitor_a_name, b.competitor_b_name, ta, tb] : [b.competitor_b_name, b.competitor_a_name, tb, ta];
    out.push({
      kind: "bout", source_id: b.id, title: b.title || `${b.competitor_a_name} vs ${b.competitor_b_name}`,
      winner: wn, detail: `${pct(wv, lv)}% of ${votes(ta + tb)}`,
      top10: rows([{ name: wn, score: `${pct(wv, lv)}%` }, { name: ln, score: `${pct(lv, wv)}%` }]),
      path: `/bout/${b.id}`,
    });
  }
  return out;
}

async function bracketDrafts(db: Db, since: string): Promise<SocialDraft[]> {
  const { data: recent } = await db
    .from("bouts").select("bracket_key").not("bracket_key", "is", null).eq("status", "final").is("deleted_at", null).gte("closes_at", since).limit(200);
  const keys = [...new Set((recent ?? []).map((r) => r.bracket_key as string))];
  const out: SocialDraft[] = [];
  for (const key of keys) {
    const { data: bs } = await db
      .from("bouts")
      .select("title, status, round_number, winner_side, competitor_a_name, competitor_b_name")
      .eq("bracket_key", key).is("deleted_at", null);
    const all = bs ?? [];
    if (!all.length || !all.every((b) => b.status === "final" && b.winner_side)) continue;
    const last = Math.max(...all.map((b) => b.round_number ?? 0));
    const reached = new Map<string, number>(); // name -> furthest round won/played
    let champion: string | null = null;
    for (const b of all) {
      const r = b.round_number ?? 0;
      const win = b.winner_side === "a" ? b.competitor_a_name : b.competitor_b_name;
      const lose = b.winner_side === "a" ? b.competitor_b_name : b.competitor_a_name;
      if (win && !/^(tbd|bye)$/i.test(win.trim())) reached.set(win, Math.max(reached.get(win) ?? 0, r + 0.5));
      if (lose && !/^(tbd|bye)$/i.test(lose.trim())) reached.set(lose, Math.max(reached.get(lose) ?? 0, r));
      if (r === last) champion = win;
    }
    if (!champion) continue;
    const order = [...reached.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const label = (score: number) => (score > last ? "Champion" : score === last ? "Finalist" : `Out in round ${score}`);
    out.push({
      kind: "bracket", source_id: key, title: all[0].title?.trim() || "Tournament bracket",
      winner: champion, detail: null,
      top10: rows(order.map(([name, s]) => ({ name, score: label(s) }))),
      path: `/bracket/${key}`,
    });
  }
  return out;
}

async function liveVoteDrafts(db: Db, since: string): Promise<SocialDraft[]> {
  const { data: events } = await db
    .from("live_vote_events").select("id, title").eq("status", "closed").eq("is_private", false).gte("closes_at", since).limit(20);
  const out: SocialDraft[] = [];
  for (const e of events ?? []) {
    const [{ data: opts }, { data: tally }] = await Promise.all([
      db.from("live_vote_options").select("id, name").eq("event_id", e.id),
      db.rpc("get_live_vote_tally", { p_event_id: e.id }),
    ]);
    const counts = new Map<string, number>();
    for (const t of tally ?? []) counts.set(t.option_id, Number(t.votes));
    const ranked = (opts ?? []).map((o) => ({ name: o.name as string, n: counts.get(o.id) ?? 0 })).sort((a, b) => b.n - a.n);
    const total = ranked.reduce((s, r) => s + r.n, 0);
    if (!ranked.length || total === 0) continue;
    out.push({
      kind: "livevote", source_id: e.id, title: e.title, winner: ranked[0].name, detail: votes(ranked[0].n),
      top10: rows(ranked.map((r) => ({ name: r.name, score: `${pct(r.n, total - r.n)}% · ${votes(r.n)}` }))),
      path: `/live-vote/${e.id}`,
    });
  }
  return out;
}

async function predictionDrafts(db: Db, since: string): Promise<SocialDraft[]> {
  const { data: slates } = await db
    .from("pred_slates").select("id, title").eq("status", "closed").eq("visibility", "public").gte("created_at", since).limit(10);
  const out: SocialDraft[] = [];
  for (const s of slates ?? []) {
    const { data: lb } = await db.rpc("pred_leaderboard", { p_scope: "season", p_slate: s.id, p_limit: 10 });
    const list = (lb ?? []) as { username: string | null; points: number | string }[];
    if (!list.length) continue;
    out.push({
      kind: "predictions", source_id: s.id, title: s.title, winner: list[0].username ? `@${list[0].username}` : null,
      detail: `${Number(list[0].points).toLocaleString()} pts`,
      top10: rows(list.map((r) => ({ name: r.username ? `@${r.username}` : "Player", score: `${Number(r.points).toLocaleString()} pts` }))),
      path: `/predictions/slate/${s.id}`,
    });
  }
  return out;
}

async function triviaDrafts(db: Db, since: string): Promise<SocialDraft[]> {
  const { data: games } = await db
    .from("trivia_games").select("id, title").eq("status", "done").gte("created_at", since).limit(10);
  const out: SocialDraft[] = [];
  for (const g of games ?? []) {
    const { data: pl } = await db.from("trivia_players").select("name, score").eq("game_id", g.id).order("score", { ascending: false }).limit(10);
    const list = pl ?? [];
    if (list.length < 3) continue; // skip tiny private rooms
    out.push({
      kind: "trivia", source_id: g.id, title: g.title, winner: list[0].name, detail: `${list[0].score} pts`,
      top10: rows(list.map((p) => ({ name: p.name as string, score: `${p.score} pts` }))),
      path: `/trivia`,
    });
  }
  return out;
}


async function boutLaunchDrafts(db: Db, since: string): Promise<SocialDraft[]> {
  const { data: bouts } = await db
    .from("bouts")
    .select("id, title, closes_at, competitor_a_name, competitor_b_name, competitor_a_submission_id, competitor_b_submission_id, sponsor_prize_description")
    .eq("created_by_admin", true).eq("status", "live").is("deleted_at", null).is("bracket_key", null).gte("created_at", since).limit(20);
  return (bouts ?? [])
    .filter((b) => b.competitor_a_submission_id && b.competitor_b_submission_id)
    .map((b) => ({
      kind: "bout_launch" as const, source_id: b.id, title: b.title || `${b.competitor_a_name} vs ${b.competitor_b_name}`,
      winner: null, detail: null, top10: [], path: `/bout/${b.id}`,
      mentionText: `${b.title} ${b.competitor_a_name} ${b.competitor_b_name}`,
      captions: boutLaunch({ a: b.competitor_a_name, b: b.competitor_b_name, closes_at: b.closes_at, prize: b.sponsor_prize_description, path: `/bout/${b.id}` }),
    }));
}

async function paidBoutLaunchDrafts(db: Db, since: string): Promise<SocialDraft[]> {
  const { data: pbs } = await db
    .from("paid_bouts")
    .select("id, title, description, entry_fee_cents, entry_deadline, max_entries, paid_bout_prizes(place, amount_cents), paid_bout_entries(status)")
    .eq("status", "open").eq("invite_only", false)
    .or(`reviewed_at.gte.${since},and(reviewed_at.is.null,created_at.gte.${since})`).limit(20);
  const out: SocialDraft[] = [];
  for (const p of pbs ?? []) {
    if (new Date(p.entry_deadline).getTime() < Date.now()) continue;
    const prizes = ((p.paid_bout_prizes ?? []) as { place: number; amount_cents: number }[]).sort((a, b) => a.place - b.place).map((x) => ({ place: x.place, cents: x.amount_cents }));
    const entered = ((p.paid_bout_entries ?? []) as { status: string }[]).filter((e) => e.status === "paid").length;
    out.push({
      kind: "paidbout_launch", source_id: p.id, title: p.title, winner: null, detail: null, top10: [], path: `/paid-bouts/${p.id}`,
      mentionText: `${p.title} ${p.description ?? ""}`,
      captions: paidBoutLaunch({
        title: p.title, feeCents: p.entry_fee_cents, poolCents: prizes.reduce((s, x) => s + x.cents, 0), prizes,
        deadline: p.entry_deadline, spotsLeft: p.max_entries ? Math.max(0, p.max_entries - entered) : null, path: `/paid-bouts/${p.id}`,
      }),
    });
  }
  return out;
}

/** Finds newly finished results and queues them. Safe to run repeatedly: each result is queued once. */
export async function queueFinishedResults(db: Db): Promise<number> {
  const { data: settings } = await db.from("social_settings").select("mode, hashtags").eq("id", 1).maybeSingle();
  if (!settings || settings.mode === "off") return 0;
  const recent = new Date(Date.now() - 3 * DAY).toISOString();
  const week = new Date(Date.now() - 7 * DAY).toISOString();

  const drafts = (
    await Promise.all([
      boutLaunchDrafts(db, recent), paidBoutLaunchDrafts(db, recent), boutDrafts(db, recent), bracketDrafts(db, recent), liveVoteDrafts(db, recent), predictionDrafts(db, week), triviaDrafts(db, week),
    ].map((p) => p.catch((e) => { console.error("social collect failed", (e as Error).message); return [] as SocialDraft[]; })))
  ).flat();

  let added = 0;
  for (const d of drafts) {
    const { data: exists } = await db.from("social_posts").select("id").eq("kind", d.kind).eq("source_id", d.source_id).maybeSingle();
    if (exists) continue;
    const base = d.captions ?? buildCaptions(d, settings.hashtags);
    const tags = schoolLines(await findSchoolTags(db, d.mentionText ?? d.title));
    const withTags = (cap: string, line: string) => (line ? `${cap}\n\n${line}` : cap);
    const cap = {
      facebook: d.captions ? withTags(`${base.facebook}\n\n${settings.hashtags}`, tags.facebook) : withTags(base.facebook, tags.facebook),
      instagram: (d.captions ? withTags(`${base.instagram}\n\n${settings.hashtags}`, tags.instagram) : withTags(base.instagram, tags.instagram)).slice(0, 2200),
    };
    const { error } = await db.from("social_posts").insert({
      kind: d.kind, source_id: d.source_id, title: d.title, winner: d.winner, top10: d.top10,
      caption_facebook: cap.facebook, caption_instagram: cap.instagram,
    });
    if (!error) added++;
  }
  return added;
}
