import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewGameForm from "@/components/NewGameForm";

export const metadata: Metadata = {
  title: "Create a prediction game",
  description: "Set up a game with two teams, a start time and optional weekly slate so fans can predict the winner and score.",
  robots: { index: false },
};

export default async function NewGamePage({ searchParams }: { searchParams: Promise<{ slate?: string }> }) {
  const { slate } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/new")}`);
  const { data: slates } = await supabase.from("pred_slates").select("id, title").eq("created_by", auth.user.id).order("created_at", { ascending: false }).limit(20);
  const preset = slate && (slates ?? []).some((s) => s.id === slate) ? slate : null;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Create a game</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Add both teams and the start time. Predictions lock the moment the game starts, and you enter the final score afterward.
      </p>
      <NewGameForm slates={slates ?? []} presetSlate={preset} />
    </div>
  );
}
