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
  let preset: string | null = null;
  if (slate) {
    const { data: owned } = await supabase.from("pred_slates").select("id, kind, created_by").eq("id", slate).maybeSingle();
    if (owned && owned.kind === "slate" && owned.created_by === auth.user.id) preset = owned.id;
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{preset ? "Add a game to your slate" : "Create your free game"}</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Add both teams and the start time. Predictions lock the moment the game starts, and you enter the final score afterward.
      </p>
      <NewGameForm presetSlate={preset} />
      {!preset && (
        <p className="mt-6 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
          Every account gets one free single game per day, open for 24 hours. Need more games, an elimination bracket or a longer schedule?{" "}
          <Link href="/predictions/bracket/new" className="font-bold underline" style={{ color: "var(--blue)" }}>Create a bracket</Link>.
        </p>
      )}
    </div>
  );
}
