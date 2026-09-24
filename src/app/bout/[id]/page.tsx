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
  const title = `${boutRow.competitor_a_name} vs ${boutRow.competitor_b_name}`;
  const categoryName = Array.isArray(boutRow.categories) ? boutRow.categories[0]?.name : boutRow.categories?.name;
  const description = `Cast your vote${categoryName ? ` in ${categoryName}` : ""} — or start your own Bout — on BoutCasts.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
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
    </div>
  );
}
