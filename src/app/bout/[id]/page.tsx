import { cardMetadata } from "@/lib/og/cardRoute";
import PlacementSponsorStrip from "@/components/PlacementSponsorStrip";
import SponsorPlacementsPanel from "@/components/SponsorPlacementsPanel";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FeaturedBout from "@/components/FeaturedBout";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: bout } = await supabase
    .from("bouts")
    .select("competitor_a_name, competitor_b_name, categories(name)")
    .eq("id", id)
    .maybeSingle();

  if (!bout) {
    return { title: "Bout" };
  }

  const boutRow = bout as {
    competitor_a_name: string;
    competitor_b_name: string;
    categories?: { name: string } | { name: string }[] | null;
  };
  return cardMetadata("bout", id, `${boutRow.competitor_a_name} vs ${boutRow.competitor_b_name}`);
}

export default async function BoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bout } = await supabase.from("bouts").select("id").eq("id", id).maybeSingle();
  if (!bout) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <FeaturedBout boutId={id} showBackLink />
      <p className="mt-4 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        Showing this at a venue or on a broadcast?{" "}
        <a href={`/bout/${id}/screen`} className="font-semibold underline">Big screen</a>{" · "}
        <a href={`/bout/${id}/screen?overlay=1`} className="font-semibold underline">Broadcast overlay</a>{" · "}
        <a href={`/bout/${id}/screen?view=count`} className="font-semibold underline">Vote counter</a>
      </p>
      <PlacementSponsorStrip kind="bout" targetId={id} variant="page" />
      <SponsorPlacementsPanel kind="bout" targetId={id} />
    </div>
  );
}
