import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrivateGameBuilder from "@/components/PrivateGameBuilder";

export const metadata: Metadata = {
  title: "Create a private prediction game",
  description: "A closed, invite-only prediction game for your group. Share a private link and a 6-letter code. Players always play free.",
  robots: { index: false },
};

export default async function NewPrivatePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/private/new")}`);
  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Create a private game</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Closed and invite-only: just your people, with their own private leaderboard. No limit on using a matchup that already exists publicly.
      </p>
      <PrivateGameBuilder />
    </div>
  );
}
