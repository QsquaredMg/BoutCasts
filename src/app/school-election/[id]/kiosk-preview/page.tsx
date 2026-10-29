import Link from "next/link";
import { notFound } from "next/navigation";
import KioskApp from "@/components/KioskApp";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, requireElectionAccess } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Organizer-only demo of the iPad booth: your real offices and candidates, any code and name works,
// and nothing is saved or counted.
export default async function KioskPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const access = await requireElectionAccess(id);
  if ("error" in access) notFound();

  const admin = createAdminClient();
  const { data: el } = await admin
    .from("school_elections")
    .select("title, school_name, brand_logo_url, cover_image_url, brand_color, brand_bg_color, brand_bg_image_url")
    .eq("id", id)
    .maybeSingle();
  if (!el) notFound();
  const { data: races } = await admin.from("live_vote_events").select("id, title").eq("election_id", id).order("election_sort");
  const raceIds = (races ?? []).map((r) => r.id as string);
  const { data: opts } = raceIds.length
    ? await admin.from("live_vote_options").select("id, event_id, name, description, image_url, source_url, source_type, sort_order").in("event_id", raceIds).order("sort_order")
    : { data: [] as { id: string; event_id: string; name: string; description: string | null; image_url: string | null; source_url: string | null; source_type: string | null }[] };

  const ballot = (races ?? []).map((r) => ({
    race_id: r.id as string,
    title: r.title as string,
    options: (opts ?? []).filter((o) => o.event_id === r.id).map((o) => ({
      id: o.id as string, name: o.name as string, description: (o.description as string | null) ?? null,
      image_url: (o.image_url as string | null) ?? null,
      video_url: o.source_type === "upload" || o.source_type === "record" ? ((o.source_url as string | null) ?? null) : null,
      clip_url: o.source_type === "link" ? ((o.source_url as string | null) ?? null) : null,
    })),
  }));

  const status = {
    label: "Preview",
    title: el.title as string,
    school: (el.school_name as string | null) ?? null,
    brand: { logo: el.brand_logo_url, banner: el.cover_image_url, color: el.brand_color, bg: el.brand_bg_color, bgImage: el.brand_bg_image_url },
    state: "open" as const,
    locked: false,
  };

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[200] flex items-center justify-between gap-3 px-4 py-2 text-sm font-bold" style={{ background: "#e0a93b", color: "#3b0d1f" }}>
        <span>Preview: type any code and name. Nothing is saved or counted.</span>
        <Link href={`/school-election/${id}`} className="rounded-full border px-3 py-1" style={{ borderColor: "#3b0d1f" }}>Close preview</Link>
      </div>
      <KioskApp token={`preview-${id}`} preview={{ status, ballot }} />
    </>
  );
}
