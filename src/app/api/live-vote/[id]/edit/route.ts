import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Organizer (or admin) editor for a live vote's content.
// Draft: everything here, including adding, removing and reordering options.
// Live: wording and photos only; options can't be added or removed once votes can exist.
// Closed: read-only.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function access(id: string) {
  if (!UUID.test(id)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) } as const;
  const admin = createAdminClient();
  const [{ data: ev }, { data: me }] = await Promise.all([
    admin.from("live_vote_events").select("id, organizer_id, election_id, status, title, description, cover_image_url, scoring_mode").eq("id", id).maybeSingle(),
    admin.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (!ev || (ev.organizer_id !== auth.user.id && !me?.is_admin)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  }
  if (ev.election_id) {
    return { error: NextResponse.json({ error: "This is an office in a school election. Edit it from the school election." }, { status: 400 }) } as const;
  }
  return { admin, ev } as const;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return a.error;
  const { data: options } = await a.admin
    .from("live_vote_options")
    .select("id, name, description, image_url, team_name, sort_order")
    .eq("event_id", id)
    .order("sort_order");
  return NextResponse.json({ event: a.ev, options: options ?? [] });
}

type OptIn = { id?: string; name?: string; description?: string | null; imageUrl?: string | null; teamName?: string | null };

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return a.error;
  const { admin, ev } = a;
  if (ev.status === "closed") return NextResponse.json({ error: "Voting has closed, so this can no longer be edited." }, { status: 400 });
  const draft = ev.status === "draft";

  const body = (await req.json().catch(() => null)) as { title?: string; description?: string | null; coverImageUrl?: string | null; options?: OptIn[] } | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const title = (body.title ?? "").trim();
  if (!title || title.length > 120) return NextResponse.json({ error: "Give the vote a title (120 characters max)." }, { status: 400 });
  const description = (body.description ?? "").trim();
  if (description.length > 1000) return NextResponse.json({ error: "The description is over 1,000 characters." }, { status: 400 });
  const opts = Array.isArray(body.options) ? body.options : [];
  if (opts.length < 2) return NextResponse.json({ error: "A vote needs at least two options." }, { status: 400 });
  if (opts.length > 64) return NextResponse.json({ error: "Too many options (64 max)." }, { status: 400 });
  for (const o of opts) {
    const n = (o.name ?? "").trim();
    if (!n || n.length > 100) return NextResponse.json({ error: "Every option needs a name (100 characters max)." }, { status: 400 });
    if ((o.description ?? "").length > 500) return NextResponse.json({ error: `The description for "${n}" is over 500 characters.` }, { status: 400 });
  }

  const { data: existing } = await admin.from("live_vote_options").select("id").eq("event_id", id);
  const have = new Set((existing ?? []).map((r) => r.id as string));
  const keep = new Set(opts.filter((o) => o.id).map((o) => o.id as string));
  for (const k of keep) if (!have.has(k)) return NextResponse.json({ error: "An option no longer exists. Reload and try again." }, { status: 409 });
  const drop = [...have].filter((x) => !keep.has(x));
  const added = opts.filter((o) => !o.id);
  if (!draft && (drop.length > 0 || added.length > 0)) {
    return NextResponse.json({ error: "Voting is open, so options can't be added or removed. You can still fix names, descriptions and photos." }, { status: 400 });
  }

  const { error: evErr } = await admin
    .from("live_vote_events")
    .update({ title, description: description || null, cover_image_url: body.coverImageUrl ?? null })
    .eq("id", id);
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    const row = {
      name: (o.name ?? "").trim(),
      description: (o.description ?? "").trim() || null,
      image_url: o.imageUrl ?? null,
      team_name: (o.teamName ?? "").trim() || null,
      ...(draft ? { sort_order: i } : {}),
    };
    if (o.id) {
      const { error } = await admin.from("live_vote_options").update(row).eq("id", o.id).eq("event_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await admin.from("live_vote_options").insert({ ...row, event_id: id, sort_order: i });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (drop.length > 0) {
    const { error } = await admin.from("live_vote_options").delete().in("id", drop);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
