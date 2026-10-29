import { NextResponse } from "next/server";
import { requireElectionAccess } from "@/lib/schoolElection";

// Organizer settings for the civics features: voter registration, the public campaign page and the forum.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  if (owner.election.status === "closed") return NextResponse.json({ error: "Voting has closed." }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.requireRegistration === "boolean") patch.require_registration = body.requireRegistration;
  if (typeof body.campaignPageEnabled === "boolean") patch.campaign_page_enabled = body.campaignPageEnabled;
  if (typeof body.linkVoting === "boolean") patch.link_voting = body.linkVoting;
  if (typeof body.forumEnabled === "boolean") patch.forum_enabled = body.forumEnabled;
  if ("registrationClosesAt" in body) {
    if (body.registrationClosesAt === null || body.registrationClosesAt === "") patch.registration_closes_at = null;
    else {
      const t = new Date(String(body.registrationClosesAt));
      if (Number.isNaN(t.getTime())) return NextResponse.json({ error: "That deadline isn't a valid date." }, { status: 400 });
      patch.registration_closes_at = t.toISOString();
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const { error } = await owner.admin.from("school_elections").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
