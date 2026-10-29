import { NextResponse } from "next/server";
import { LIVE_VOTE_TIERS, SCHOOL_ELECTION, schoolElectionPriceCents, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";
import { isHexColor } from "@/lib/liveVoteEvents/roomTheme";
import { hashPin, requireElectionAccess, UUID } from "@/lib/schoolElection";
import { normalizeVideoLink } from "@/lib/clipSource";

// Edit a school election after it was created. Everything is editable while it is a draft. Once voting is
// open the offices and candidates are locked (nobody's votes can be invalidated), but names, descriptions,
// photos, videos, the look and the close time can still be fixed. Money settings stay with the owner/admin.

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const httpsUrl = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s"'()\\]{1,600}$/i.test(v) ? v : null);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireElectionAccess(id);
  if ("error" in who) return who.error;
  const { admin, election: e, viewerRole } = who;
  const { data: races } = await admin.from("live_vote_events").select("id, title, election_sort").eq("election_id", id).order("election_sort");
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: opts } = raceIds.length
    ? await admin.from("live_vote_options").select("id, event_id, name, description, image_url, source_type, source_url, media_seconds, sort_order, created_at").in("event_id", raceIds).order("sort_order").order("created_at")
    : { data: [] as { id: string; event_id: string; name: string; description: string | null; image_url: string | null; source_type: string | null; source_url: string | null; media_seconds: number | null }[] };
  return NextResponse.json(
    {
      title: e.title, schoolName: e.school_name, tier: e.tier, kiosks: e.kiosks, days: e.days, status: e.status, closesAt: e.closes_at, openEnded: e.open_ended, isPractice: e.is_practice,
      brandLogoUrl: e.brand_logo_url, coverImageUrl: e.cover_image_url, brandBgImageUrl: e.brand_bg_image_url, brandColor: e.brand_color, brandBgColor: e.brand_bg_color,
      showTally: e.show_tally, linkVoting: e.link_voting, canBilling: viewerRole !== "moderator",
      races: (races ?? []).map((r) => ({
        id: r.id, title: r.title,
        candidates: (opts ?? []).filter((o) => o.event_id === r.id).map((o) => ({ id: o.id, name: o.name, description: o.description, imageUrl: o.image_url, sourceType: o.source_type, sourceUrl: o.source_url, mediaSeconds: o.media_seconds })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

type Cand = { id?: unknown; name?: unknown; description?: unknown; photoUrl?: unknown; videoUrl?: unknown; videoSeconds?: unknown; videoLink?: unknown };
type Race = { id?: unknown; title?: unknown; candidates?: unknown };

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireElectionAccess(id);
  if ("error" in who) return who.error;
  const { admin, election: el, viewerRole } = who;
  const isMod = viewerRole === "moderator";
  const isAdmin = viewerRole === "admin";
  if (el.status === "closed") return NextResponse.json({ error: "This election is closed and can't be edited." }, { status: 400 });
  const draft = el.status === "draft";
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // ---- basics
  const title = clean(body.title, 120);
  if (!title) return NextResponse.json({ error: "Give the election a name." }, { status: 400 });
  const schoolName = clean(body.schoolName, 120) || null;
  const brand = {
    brand_logo_url: httpsUrl(body.brandLogoUrl),
    cover_image_url: httpsUrl(body.coverImageUrl),
    brand_bg_image_url: httpsUrl(body.brandBgImageUrl),
    brand_color: isHexColor(body.brandColor) ? (body.brandColor as string) : null,
    brand_bg_color: isHexColor(body.brandBgColor) ? (body.brandBgColor as string) : null,
  };
  const patch: Record<string, unknown> = { title, school_name: schoolName, show_tally: body.showTally !== false, link_voting: body.linkVoting === true, ...brand };

  // ---- billing settings: owner/admin, draft only
  let tier = el.tier as LiveVoteTier;
  if (draft && !isMod && !el.is_practice) {
    const nt = body.tier as LiveVoteTier;
    const kiosks = Number(body.kiosks);
    const days = Number(body.days);
    if (!SCHOOL_ELECTION.tiers.includes(nt)) return NextResponse.json({ error: "Pick a size." }, { status: 400 });
    if (!Number.isInteger(kiosks) || kiosks < 1 || kiosks > SCHOOL_ELECTION.maxKiosks) return NextResponse.json({ error: "Choose 1 to 3 kiosks." }, { status: 400 });
    if (!Number.isInteger(days) || days < 1 || days > SCHOOL_ELECTION.maxDays) return NextResponse.json({ error: "Voting can run 1 to 3 days." }, { status: 400 });
    const [{ count: paired }, { count: roster }] = await Promise.all([
      admin.from("election_kiosks").select("id", { count: "exact", head: true }).eq("election_id", id),
      admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id),
    ]);
    if ((paired ?? 0) > kiosks) return NextResponse.json({ error: `${paired} kiosks are already paired. Remove one first to go lower.` }, { status: 400 });
    if ((roster ?? 0) > LIVE_VOTE_TIERS[nt].voteCap) return NextResponse.json({ error: `The roster has ${roster} students, more than a ${LIVE_VOTE_TIERS[nt].label} election holds.` }, { status: 400 });
    tier = nt;
    Object.assign(patch, { tier: nt, kiosks, days, price_cents: schoolElectionPriceCents(nt, kiosks, days) });
  }
  if (typeof body.pin === "string" && body.pin !== "") {
    if (!/^\d{6}$/.test(body.pin)) return NextResponse.json({ error: "The teacher PIN must be 6 digits." }, { status: 400 });
    patch.exit_pin_hash = hashPin(body.pin);
  }

  // ---- close time (live only, owner/admin): shorten, or restore up to what was paid for
  let newClose: string | null = null;
  if (!draft && !isMod && !el.open_ended && typeof body.closesAt === "string" && body.closesAt) {
    const t = new Date(body.closesAt);
    if (Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) return NextResponse.json({ error: "Pick a close time in the future." }, { status: 400 });
    const start = el.starts_at ? new Date(el.starts_at).getTime() : Date.now();
    const paidMs = (el.tier === "free" && el.days === 1 ? 12 : el.days * 24) * 3600 * 1000;
    if (!isAdmin && t.getTime() > start + paidMs) return NextResponse.json({ error: "That is past the time you paid for. Contact support to add days." }, { status: 400 });
    if (!el.closes_at || t.getTime() !== new Date(el.closes_at).getTime()) newClose = t.toISOString();
  }

  // ---- ballot
  const bodyRaces: Race[] = Array.isArray(body.races) ? body.races : [];
  if (bodyRaces.length < 1 || bodyRaces.length > 12) return NextResponse.json({ error: "Add between 1 and 12 offices." }, { status: 400 });
  const { data: curRaces } = await admin.from("live_vote_events").select("id").eq("election_id", id);
  const curRaceIds = new Set((curRaces ?? []).map((r) => r.id as string));
  const { data: curOpts } = curRaceIds.size ? await admin.from("live_vote_options").select("id, event_id").in("event_id", [...curRaceIds]) : { data: [] as { id: string; event_id: string }[] };
  const optRace = new Map((curOpts ?? []).map((o) => [o.id as string, o.event_id as string]));

  const parsed = bodyRaces.map((r) => {
    const rid = typeof r.id === "string" && UUID.test(r.id) ? r.id : null;
    const cands = (Array.isArray(r.candidates) ? (r.candidates as Cand[]) : []).map((c) => {
      const link = typeof c.videoLink === "string" && c.videoLink.trim() ? normalizeVideoLink(c.videoLink) : null;
      return {
        id: typeof c.id === "string" && UUID.test(c.id) ? c.id : null,
        name: clean(c.name, 80),
        description: clean(c.description, 200) || null,
        photo: httpsUrl(c.photoUrl),
        video: httpsUrl(c.videoUrl),
        link,
        badLink: typeof c.videoLink === "string" && c.videoLink.trim() !== "" && !link,
        seconds: Number.isFinite(Number(c.videoSeconds)) && Number(c.videoSeconds) > 0 ? Math.min(Math.round(Number(c.videoSeconds)), 600) : null,
      };
    }).filter((c) => c.name);
    return { id: rid, title: clean(r.title, 120), cands };
  });
  for (const r of parsed) {
    if (!r.title) return NextResponse.json({ error: "Every office needs a title." }, { status: 400 });
    if (r.cands.length < 2 || r.cands.length > 12) return NextResponse.json({ error: `"${r.title}" needs 2 to 12 candidates.` }, { status: 400 });
    const bad = r.cands.find((c) => c.badLink);
    if (bad) return NextResponse.json({ error: `The video link for ${bad.name} isn't one we can play.` }, { status: 400 });
    if (r.id && !curRaceIds.has(r.id)) return NextResponse.json({ error: "An office on the page no longer exists. Reload and try again." }, { status: 400 });
    for (const c of r.cands) if (c.id && optRace.get(c.id) !== r.id) return NextResponse.json({ error: "A candidate on the page no longer exists. Reload and try again." }, { status: 400 });
  }
  if (!draft) {
    const keepRaces = new Set(parsed.map((r) => r.id));
    const sameRaces = parsed.every((r) => r.id) && keepRaces.size === curRaceIds.size && [...curRaceIds].every((x) => keepRaces.has(x));
    const sameCands = sameRaces && parsed.every((r) => {
      const have = [...optRace.entries()].filter(([, rid]) => rid === r.id).map(([oid]) => oid);
      return r.cands.every((c) => c.id) && r.cands.length === have.length && new Set(r.cands.map((c) => c.id)).size === have.length;
    });
    if (!sameRaces || !sameCands) return NextResponse.json({ error: "Offices and candidates are locked once voting opens. You can still edit their names, descriptions, photos and videos." }, { status: 400 });
  }

  // ---- write
  const { error: upErr } = await admin.from("school_elections").update({ ...patch, ...(newClose ? { closes_at: newClose } : {}) }).eq("id", id);
  if (upErr) {
    console.error("school-election setup: election update failed", upErr);
    return NextResponse.json({ error: "Couldn't save your changes." }, { status: 500 });
  }
  const free = tier === "free";
  const raceCommon = {
    description: `${title}${schoolName ? ` · ${schoolName}` : ""}`,
    brand_name: free ? null : schoolName,
    ...(free ? {} : brand),
  };
  const media = (c: (typeof parsed)[number]["cands"][number]) =>
    c.video ? { source_type: "upload", source_url: c.video, media_seconds: c.seconds } : c.link ? { source_type: "link", source_url: c.link, media_seconds: null } : { source_type: null, source_url: null, media_seconds: null };

  try {
    const keptRaces = new Set<string>();
    for (let i = 0; i < parsed.length; i++) {
      const r = parsed[i];
      let raceId = r.id;
      if (raceId) {
        const { error } = await admin.from("live_vote_events").update({ title: r.title, ...raceCommon, ...(draft ? { election_sort: i, tier, price_cents: LIVE_VOTE_TIERS[tier].priceCents } : {}), ...(newClose ? { closes_at: newClose } : {}) }).eq("id", raceId);
        if (error) throw error;
      } else {
        const { data: ev, error } = await admin.from("live_vote_events").insert({
          organizer_id: el.organizer_id, title: r.title, ...raceCommon,
          voter_mode: "open_link", voting_method: "single", scoring_mode: "crowd",
          tier, price_cents: LIVE_VOTE_TIERS[tier].priceCents, status: "draft", is_private: true, election_id: id, election_sort: i,
        }).select("id").single();
        if (error || !ev) throw error ?? new Error("race insert failed");
        raceId = ev.id as string;
      }
      keptRaces.add(raceId);
      const keptOpts: string[] = [];
      for (let j = 0; j < r.cands.length; j++) {
        const c = r.cands[j];
        const row = { name: c.name, description: c.description, image_url: c.photo, ...media(c) };
        if (c.id) {
          const { error } = await admin.from("live_vote_options").update({ ...row, ...(draft ? { sort_order: j } : {}) }).eq("id", c.id);
          if (error) throw error;
          keptOpts.push(c.id);
        } else {
          const { data: o, error } = await admin.from("live_vote_options").insert({ event_id: raceId, sort_order: j, ...row }).select("id").single();
          if (error || !o) throw error ?? new Error("option insert failed");
          keptOpts.push(o.id as string);
        }
      }
      if (draft) {
        const drop = [...optRace.entries()].filter(([oid, rid]) => rid === raceId && !keptOpts.includes(oid)).map(([oid]) => oid);
        if (drop.length) {
          const { error } = await admin.from("live_vote_options").delete().in("id", drop);
          if (error) throw error;
        }
      }
    }
    if (draft) {
      const dropRaces = [...curRaceIds].filter((rid) => !keptRaces.has(rid));
      if (dropRaces.length) {
        const { error } = await admin.from("live_vote_events").delete().in("id", dropRaces);
        if (error) throw error;
      }
    }
  } catch (err) {
    console.error("school-election setup: ballot update failed", err);
    return NextResponse.json({ error: "Saved the basics, but couldn't finish updating the ballot. Reload and check it." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
