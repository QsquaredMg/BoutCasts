import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bout } from "@/lib/types";
import BracketTree from "@/components/BracketTree";
import ShareButton from "@/components/ShareButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const supabase = await createClient();
  const { data: bouts } = await supabase
    .from("bouts")
    .select("categories(name)")
    .eq("bracket_key", key)
    .limit(1);

  const first = bouts?.[0] as { categories?: { name: string } | { name: string }[] | null } | undefined;
  const categoryName = Array.isArray(first?.categories) ? first?.categories[0]?.name : first?.categories?.name;
  const title = categoryName ? `${categoryName} Bracket` : "Bracket";
  const description = "Vote through the bracket as it fills in — or start your own Bout — on BoutCasts.";

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function BracketPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const supabase = await createClient();

  const { data: boutsRaw } = await supabase
    .from("bouts")
    .select("*, categories(name)")
    .eq("bracket_key", key)
    .order("round_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (!boutsRaw || boutsRaw.length === 0) {
    notFound();
  }

  const bouts = boutsRaw as Bout[];
  const categoryName = (bouts[0] as Bout).categories?.name ?? "Bracket";

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/matchups" className="inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
          &larr; Back to matchups
        </Link>
        <ShareButton
          title={`${categoryName} Bracket`}
          text={`${categoryName} Bracket — vote now, or start your own Bout, on BoutCasts!`}
        />
      </div>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {categoryName}
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Tournament bracket — winners advance automatically when voting closes.
      </p>

      <BracketTree bouts={bouts} bracketKey={key} />
    </div>
  );
}
