import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredBracketBuilder from "@/components/PredBracketBuilder";

export const metadata: Metadata = {
  title: "Create a prediction bracket",
  description: "Set up an elimination bracket or a slate of games, pay once, and let your players predict every winner and score for free.",
  robots: { index: false },
};

export default async function NewBracketPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/bracket/new")}`);
  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Create a bracket</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Schedule many games at once. Predictions lock the moment the first game starts, and you enter the final scores as games finish.
      </p>
      <PredBracketBuilder />
    </div>
  );
}
