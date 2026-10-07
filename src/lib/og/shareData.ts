import type { SupabaseClient } from "@supabase/supabase-js";
import { logoDataUrl, loadBoutSponsor } from "@/lib/og/sponsor";
import { videoThumb, type CardData, type CardType, type Contender } from "@/lib/og/shareCard";
import { LOCK_GRACE_MS } from "@/lib/predictions/types";

// Loads what each kind of share card needs. Every loader returns null when the thing
// doesn't exist, so callers can fall back to a plain card.

const UUID = /^[0-9a-f-]{36}$/i;
const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);
const past = (t: number | null) => t !== null && t < Date.now();
const MAX_SHOWN = 4;
const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

type SubRef = { source_type: string | null; source_url: string | null };

async function submissionThumbs(supabase: SupabaseClient, ids: (string | null)[], imgs: boolean): Promise<Map<string, string | null>> {
  const want = ids.filter((x): x is string => !!x);
  const out = new Map<string, string | null>();
  if (!want.length || !imgs) return out;
  const { data } = await supabase.from("submissions").select("id, source_type, source_url").in("id", want);
  await Promise.all(((data ?? []) as (SubRef & { id: string })[]).map(async (s) => out.set(s.id, await videoThumb(s.source_type, s.source_url))));
  return out;
}

function shown(all: Contender[]) {
  return { contenders: all.slice(0, MAX_SHOWN), more: Math.max(0, all.length - MAX_SHOWN) };
}

export async function loadPredGameCard(supabase: SupabaseClient, id: string, imgs = true): Promise<CardData | null> {
  const L = (u?: string | null) => (imgs ? logoDataUrl(u) : Promise.resolve(null));
  if (!UUID.test(id)) return null;
  const { data: g } = await supabase
    .from("pred_games")
    .select("home_name, away_name, home_logo, away_logo, starts_at, is_private, status")
    .eq("id", id)
    .maybeSingle();
  if (!g) return null;
  const [h, a] = await Promise.all([L(g.home_logo), L(g.away_logo)]);
  const start = ms(g.starts_at);
  const close = start === null ? null : start + LOCK_GRACE_MS;
  return {
    type: "predictions",
    kicker: g.is_private ? "🔒 Private game" : null,
    contenders: [{ name: g.home_name, img: h }, { name: g.away_name, img: a }],
    startMs: start,
    closeMs: close,
    closeLabel: past(close) ? "Picks closed" : "Picks close",
    cta: "Call the winner and the score at boutcasts.com/predictions",
  };
}

export async function loadPredSlateCard(supabase: SupabaseClient, id: string, imgs = true): Promise<CardData | null> {
  const L = (u?: string | null) => (imgs ? logoDataUrl(u) : Promise.resolve(null));
  if (!UUID.test(id)) return null;
  const { data: s } = await supabase.from("pred_slates").select("title, visibility, kind, brand_name, brand_logo_url").eq("id", id).maybeSingle();
  if (!s) return null;
  const { data: games } = await supabase
    .from("pred_games")
    .select("home_name, away_name, home_logo, away_logo, starts_at")
    .eq("slate_id", id)
    .neq("status", "cancelled")
    .order("starts_at")
    .limit(1);
  const g = games?.[0];
  const [h, a, brand] = await Promise.all([L(g?.home_logo), L(g?.away_logo), L(s.brand_logo_url)]);
  const start = ms(g?.starts_at);
  const close = start === null ? null : start + LOCK_GRACE_MS;
  return {
    type: "predictions",
    kicker: `${s.visibility === "private" ? "🔒 Private · " : ""}${s.kind === "elimination" ? "Bracket" : "Weekly pick'em"}`,
    title: s.title,
    contenders: g ? [{ name: g.home_name, img: h }, { name: g.away_name, img: a }] : [],
    startMs: start,
    startLabel: "First game",
    closeMs: close,
    closeLabel: past(close) ? "First picks closed" : "First picks close",
    sponsor: s.brand_name ? { name: s.brand_name, logo: brand } : null,
    cta: "Make your picks at boutcasts.com/predictions",
  };
}

export async function loadBoutCard(supabase: SupabaseClient, id: string, imgs = true): Promise<CardData | null> {
  if (!UUID.test(id)) return null;
  const { data: b } = await supabase
    .from("bouts")
    .select("title, status, created_at, closes_at, competitor_a_name, competitor_b_name, competitor_a_submission_id, competitor_b_submission_id, winner_side, sponsor_id, category_id, categories(name)")
    .eq("id", id)
    .maybeSingle();
  if (!b) return null;
  const [thumbs, sponsor, votes] = await Promise.all([
    submissionThumbs(supabase, [b.competitor_a_submission_id, b.competitor_b_submission_id], imgs),
    loadBoutSponsor(supabase, b),
    supabase.from("votes").select("side").eq("bout_id", id),
  ]);
  let ta = 0, tb = 0;
  for (const v of votes.data ?? []) { if (v.side === "a") ta++; else tb++; }
  const total = ta + tb;
  const pa = total ? Math.round((ta / total) * 100) : 50;
  const close = ms(b.closes_at);
  const cat = one(b.categories as { name: string } | { name: string }[] | null)?.name ?? null;
  return {
    type: "bout",
    kicker: b.status === "final" ? `Final result${cat ? ` · ${cat}` : ""}` : cat,
    title: b.title,
    contenders: [
      { name: b.competitor_a_name, img: b.competitor_a_submission_id ? (thumbs.get(b.competitor_a_submission_id) ?? null) : null, color: "#d92c4c" },
      { name: b.competitor_b_name, img: b.competitor_b_submission_id ? (thumbs.get(b.competitor_b_submission_id) ?? null) : null, color: "#1f5fd6" },
    ],
    pct: total ? [pa, 100 - pa] : null,
    winner: b.winner_side === "a" ? 0 : b.winner_side === "b" ? 1 : null,
    startMs: ms(b.created_at),
    startLabel: "Voting opened",
    closeMs: close,
    closeLabel: b.status === "final" || past(close) ? "Voting closed" : close ? "Voting closes" : "Voting is open",
    facts: total ? [`${total.toLocaleString()} vote${total === 1 ? "" : "s"}`] : undefined,
    sponsor,
    cta: "Cast your vote at boutcasts.com",
  };
}

export async function loadBracketCard(supabase: SupabaseClient, key: string, imgs = true): Promise<CardData | null> {
  const { data } = await supabase
    .from("bouts")
    .select("title, status, round_number, created_at, closes_at, competitor_a_name, competitor_b_name, competitor_a_submission_id, competitor_b_submission_id, sponsor_id, category_id, categories(name)")
    .eq("bracket_key", key)
    .order("round_number", { ascending: true });
  const bouts = data ?? [];
  if (!bouts.length) return null;
  const first = bouts[0];
  const round1 = bouts.filter((x) => x.round_number === first.round_number);
  const entries: { name: string; sub: string | null }[] = [];
  for (const x of round1) {
    entries.push({ name: x.competitor_a_name, sub: x.competitor_a_submission_id }, { name: x.competitor_b_name, sub: x.competitor_b_submission_id });
  }
  const real = entries.filter((e) => e.name && !/^(tbd|bye)$/i.test(e.name.trim()));
  const thumbs = await submissionThumbs(supabase, real.slice(0, MAX_SHOWN).map((e) => e.sub), imgs);
  const all: Contender[] = real.map((e, i) => ({ name: e.name, img: i < MAX_SHOWN && e.sub ? (thumbs.get(e.sub) ?? null) : null }));
  const rounds = new Set(bouts.map((x) => x.round_number)).size;
  const live = bouts.filter((x) => x.status === "live" && x.closes_at);
  const nextClose = live.length ? Math.min(...live.map((x) => new Date(x.closes_at as string).getTime())) : null;
  const done = bouts.every((x) => x.status === "final");
  const cat = one(first.categories as { name: string } | { name: string }[] | null)?.name ?? null;
  const sponsor = await loadBoutSponsor(supabase, first);
  return {
    type: "bracket",
    kicker: [cat, `${rounds} round${rounds === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
    title: first.title?.trim() || (cat ? `${cat} Bracket` : "Tournament bracket"),
    ...shown(all),
    startMs: Math.min(...bouts.map((x) => new Date(x.created_at).getTime())),
    startLabel: "Started",
    closeMs: nextClose,
    closeLabel: done ? "Bracket complete" : nextClose ? "This round closes" : "Next round coming up",
    sponsor,
    cta: "Vote through the bracket at boutcasts.com",
  };
}

export async function loadLiveVoteCard(supabase: SupabaseClient, id: string, imgs = true): Promise<CardData | null> {
  const L = (u?: string | null) => (imgs ? logoDataUrl(u) : Promise.resolve(null));
  if (!UUID.test(id)) return null;
  const { data: e } = await supabase
    .from("live_vote_events")
    .select("title, brand_name, brand_logo_url, status, starts_at, closes_at, created_at, is_private, voting_method")
    .eq("id", id)
    .maybeSingle();
  if (!e) return null;
  const { data: opts } = await supabase
    .from("live_vote_options")
    .select("name, image_url, thumbnail_url")
    .eq("event_id", id)
    .order("sort_order");
  const list = opts ?? [];
  const pics = await Promise.all(list.slice(0, MAX_SHOWN).map((o) => L(o.image_url ?? o.thumbnail_url)));
  const all: Contender[] = list.map((o, i) => ({ name: o.name, img: i < MAX_SHOWN ? pics[i] : null }));
  const brand = await L(e.brand_logo_url);
  const close = ms(e.closes_at);
  const closed = e.status === "closed" || past(close);
  return {
    type: "livevote",
    kicker: [e.is_private ? "🔒 Private" : null, e.brand_name ? `Presented by ${e.brand_name}` : null].filter(Boolean).join(" · ") || null,
    title: e.title,
    ...shown(all),
    startMs: ms(e.starts_at) ?? ms(e.created_at),
    closeMs: close,
    closeLabel: closed ? "Voting closed" : close ? "Voting closes" : "Voting is open",
    facts: list.length ? [`${list.length} option${list.length === 1 ? "" : "s"}`] : undefined,
    sponsor: e.brand_name ? { name: e.brand_name, logo: brand } : null,
    cta: "Cast your vote at boutcasts.com",
  };
}

export async function loadCompetitionCard(supabase: SupabaseClient, id: string, imgs = true): Promise<CardData | null> {
  const L = (u?: string | null) => (imgs ? logoDataUrl(u) : Promise.resolve(null));
  if (!UUID.test(id)) return null;
  const { data: c } = await supabase
    .from("categories")
    .select("name, description, created_at, sponsors(name, logo_url)")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const { data: bouts } = await supabase
    .from("bouts")
    .select("status, closes_at, created_at, competitor_a_name, competitor_b_name, competitor_a_submission_id, competitor_b_submission_id")
    .eq("category_id", id)
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = bouts ?? [];
  const live = rows.filter((b) => b.status === "live");
  const closes = live.map((b) => (b.closes_at ? new Date(b.closes_at).getTime() : null)).filter((t): t is number => t !== null);
  const nextClose = closes.length ? Math.min(...closes) : null;
  const sp = one(c.sponsors as { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null);
  const names = new Map<string, string | null>();
  for (const b of live.length ? live : rows) {
    if (!names.has(b.competitor_a_name)) names.set(b.competitor_a_name, b.competitor_a_submission_id);
    if (!names.has(b.competitor_b_name)) names.set(b.competitor_b_name, b.competitor_b_submission_id);
  }
  const entries = [...names.entries()];
  const thumbs = await submissionThumbs(supabase, entries.slice(0, MAX_SHOWN).map(([, s]) => s), imgs);
  const all: Contender[] = entries.map(([name, sub], i) => ({ name, img: i < MAX_SHOWN && sub ? (thumbs.get(sub) ?? null) : null }));
  const spLogo = sp ? await L(sp.logo_url) : null;
  const created = rows.length ? Math.min(...rows.map((b) => new Date(b.created_at).getTime())) : ms(c.created_at);
  return {
    type: "competition",
    kicker: sp?.name ? `Presented by ${sp.name}` : null,
    title: c.name,
    ...shown(all),
    startMs: created,
    startLabel: "Started",
    closeMs: nextClose,
    closeLabel: nextClose ? "Next voting closes" : "Watch the matchups",
    facts: [`${live.length} live bout${live.length === 1 ? "" : "s"}`],
    sponsor: sp?.name ? { name: sp.name, logo: spLogo } : null,
    cta: "Watch and vote at boutcasts.com",
  };
}

export async function loadShowcaseCard(supabase: SupabaseClient, id: string, imgs = true): Promise<CardData | null> {
  const L = (u?: string | null) => (imgs ? logoDataUrl(u) : Promise.resolve(null));
  if (!UUID.test(id)) return null;
  const { data: s } = await supabase.from("showcases").select("title, kind, created_at, closes_at, status").eq("id", id).maybeSingle();
  if (!s) return null;
  const { data: ch } = await supabase.from("showcase_choices").select("name, image_url").eq("showcase_id", id).order("sort_order");
  const list = ch ?? [];
  const pics = await Promise.all(list.slice(0, MAX_SHOWN).map((c) => L(c.image_url)));
  const all: Contender[] = list.map((c, i) => ({ name: c.name, img: i < MAX_SHOWN ? pics[i] : null }));
  const close = ms(s.closes_at);
  const closed = s.status === "closed" || past(close);
  return {
    type: "showcase",
    kicker: s.kind === "debate" ? "Panel debate" : "Group showcase",
    title: s.title,
    ...shown(all),
    startMs: ms(s.created_at),
    startLabel: "Opened",
    closeMs: close,
    closeLabel: closed ? "Voting closed" : close ? "Voting closes" : "Voting is open",
    facts: list.length ? [`${list.length} entries`] : undefined,
    cta: "Watch and vote at boutcasts.com/showcase",
  };
}

export async function loadDebateCard(supabase: SupabaseClient, id: string, _imgs = true): Promise<CardData | null> {
  if (!UUID.test(id)) return null;
  const { data: t } = await supabase.from("debate_topics").select("statement, format, bracket_size, status, created_at").eq("id", id).maybeSingle();
  if (!t) return null;
  const { data: m } = await supabase.from("debate_matches").select("status, voting_closes_at").eq("topic_id", id).eq("status", "voting");
  const closes = (m ?? []).map((x) => (x.voting_closes_at ? new Date(x.voting_closes_at).getTime() : null)).filter((x): x is number => x !== null);
  const nextClose = closes.length ? Math.min(...closes) : null;
  const done = t.status === "complete" || t.status === "closed" || t.status === "final";
  return {
    type: "debate",
    kicker: t.bracket_size ? `${t.bracket_size}-person bracket` : "Head to head",
    title: t.statement,
    contenders: [{ name: "For", img: null, color: "#1f9d55" }, { name: "Against", img: null, color: "#d92c4c" }],
    startMs: ms(t.created_at),
    startLabel: "Opened",
    closeMs: nextClose,
    closeLabel: done ? "Debate complete" : nextClose ? "Voting closes" : "Join the debate",
    cta: "Join or vote at boutcasts.com/debates",
  };
}

export async function loadPaidBoutCard(supabase: SupabaseClient, id: string, _imgs = true): Promise<CardData | null> {
  if (!UUID.test(id)) return null;
  const { data: p } = await supabase
    .from("paid_bouts")
    .select("title, entry_fee_cents, min_entries, max_entries, entry_deadline, created_at, status, invite_only")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  const close = ms(p.entry_deadline);
  const facts = [money(p.entry_fee_cents) + " entry"];
  if (p.max_entries) facts.push(`${p.max_entries} spots`);
  return {
    type: "paidbout",
    kicker: p.invite_only ? "Invite only" : "Entry-fee competition",
    title: p.title,
    contenders: [],
    startMs: ms(p.created_at),
    startLabel: "Opened",
    closeMs: close,
    closeLabel: past(close) ? "Entries closed" : close ? "Entries close" : "Entries open",
    facts,
    cta: "Enter at boutcasts.com/paid-bouts",
  };
}

export const CARD_LOADERS: Record<CardType | "predictions-slate", (s: SupabaseClient, id: string, imgs?: boolean) => Promise<CardData | null>> = {
  predictions: loadPredGameCard,
  "predictions-slate": loadPredSlateCard,
  bout: loadBoutCard,
  bracket: loadBracketCard,
  livevote: loadLiveVoteCard,
  competition: loadCompetitionCard,
  showcase: loadShowcaseCard,
  debate: loadDebateCard,
  paidbout: loadPaidBoutCard,
};
