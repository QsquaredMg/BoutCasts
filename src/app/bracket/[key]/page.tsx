import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bout } from "@/lib/types";
import BracketTree from "@/components/BracketTree";

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

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <Link href="/matchups" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {(bouts[0] as Bout).categories?.name ?? "Bracket"}
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Tournament bracket — winners advance automatically when voting closes.
      </p>

      <BracketTree bouts={bouts} bracketKey={key} />
    </div>
  );
}
