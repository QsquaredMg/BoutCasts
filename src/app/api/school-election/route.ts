import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIVE_VOTE_TIERS, SCHOOL_ELECTION, schoolElectionPriceCents, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";
import { isHexColor } from "@/lib/liveVoteEvents/roomTheme";
import { hashPin } from "@/lib/schoolElection";

// Create a school election (a draft): its races, candidates, size, kiosks and days. Paying activates it.
type Candidate = { name?: unknown; description?: unknown; photoUrl?: unknown; videoUrl?: unknown; videoSeconds?: unknown };
type Race = { title?: unknown; candidates?: unknown };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const title = clean(body.title, 120);
  const schoolName = clean(body.schoolName, 120) || null;
  const tier = body.tier as LiveVoteTier;
  const kiosks = Number(body.kiosks);
  const days = Number(body.days);
  const pin = typeof body.pin === "string" ? body.pin : "";
  const httpsUrl = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s"'()\\]{1,600}$/i.test(v) ? v : null);
  const brand = {
    brand_logo_url: httpsUrl(body.brandLogoUrl),
    cover_image_url: httpsUrl(body.coverImageUrl),
    brand_bg_image_url: httpsUrl(body.brandBgImageUrl),
    brand_color: isHexColor(body.brandColor) ? body.brandColor : null,
    brand_bg_color: isHexColor(body.brandBgColor) ? body.brandBgColor : null,
  };
  const showTally = body.showTally !== false;
  const races: Race[] = Array.isArray(body.races) ? body.races : [];

  if (!title) return NextResponse.json({ error: "Give the election a name." }, { status: 400 });
  if (!SCHOOL_ELECTION.tiers.includes(tier)) return NextResponse.json({ error: "Pick a size." }, { status: 400 });
  if (!Number.isInteger(kiosks) || kiosks < 1 || kiosks > SCHOOL_ELECTION.maxKiosks) return NextResponse.json({ error: "Choose 1 to 3 kiosks." }, { status: 400 });
  if (!Number.isInteger(days) || days < 1 || days > SCHOOL_ELECTION.maxDays) return NextResponse.json({ error: "Voting can run 1 to 3 days." }, { status: 400 });
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: "The teacher PIN must be 6 digits." }, { status: 400 });
  if (races.length < 1 || races.length > 12) return NextResponse.json({ error: "Add between 1 and 12 offices." }, { status: 400 });

  const parsed = races.map((r) => {
    const cands = (Array.isArray(r.candidates) ? (r.candidates as Candidate[]) : [])
      .map((c) => ({
        name: clean(c.name, 80),
        description: clean(c.description, 200) || null,
        photo: httpsUrl(c.photoUrl),
        video: httpsUrl(c.videoUrl),
        seconds: Number.isFinite(Number(c.videoSeconds)) && Number(c.videoSeconds) > 0 ? Math.min(Math.round(Number(c.videoSeconds)), 600) : null,
      }))
      .filter((c) => c.name);
    return { title: clean(r.title, 120), candidates: cands };
  });
  for (const r of parsed) {
    if (!r.title) return NextResponse.json({ error: "Every office needs a title." }, { status: 400 });
    if (r.candidates.length < 2 || r.candidates.length > 12) return NextResponse.json({ error: `"${r.title}" needs 2 to 12 candidates.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
  if (tier === "free" && !me?.is_admin) {
    // Same pacing as Free live votes: 5 per 30 days.
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from("school_elections").select("id", { count: "exact", head: true }).eq("organizer_id", auth.user.id).eq("tier", "free").gte("created_at", since);
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "Free elections are limited to 5 every 30 days. Pick Small or larger." }, { status: 400 });
  }
  const { data: election, error } = await admin
    .from("school_elections")
    .insert({
      organizer_id: auth.user.id,
      title,
      school_name: schoolName,
      tier,
      kiosks,
      days,
      price_cents: schoolElectionPriceCents(tier, kiosks, days),
      exit_pin_hash: hashPin(pin),
      show_tally: showTally,
      ...brand,
    })
    .select("id")
    .single();
  if (error || !election) {
    console.error("school-election: create failed", error);
    return NextResponse.json({ error: "Couldn't create the election." }, { status: 500 });
  }

  try {
    for (let i = 0; i < parsed.length; i++) {
      const race = parsed[i];
      const { data: ev, error: evErr } = await admin
        .from("live_vote_events")
        .insert({
          organizer_id: auth.user.id,
          title: race.title,
          description: `${title}${schoolName ? ` · ${schoolName}` : ""}`,
          voter_mode: "open_link",
          voting_method: "single",
          scoring_mode: "crowd",
          tier,
          price_cents: LIVE_VOTE_TIERS[tier].priceCents,
          status: "draft",
          is_private: true,
          election_id: election.id,
          election_sort: i,
          brand_name: tier === "free" ? null : schoolName,
          ...(tier === "free" ? {} : brand),
        })
        .select("id")
        .single();
      if (evErr || !ev) throw evErr ?? new Error("race insert failed");
      const { error: optErr } = await admin
        .from("live_vote_options")
        .insert(race.candidates.map((c, j) => ({ event_id: ev.id, name: c.name, description: c.description, sort_order: j, image_url: c.photo, ...(c.video ? { source_type: "upload", source_url: c.video, media_seconds: c.seconds } : {}) })));
      if (optErr) throw optErr;
    }
  } catch (err) {
    console.error("school-election: races failed", err);
    await admin.from("school_elections").delete().eq("id", election.id);
    return NextResponse.json({ error: "Couldn't save the offices. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ id: election.id });
}
