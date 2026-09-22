import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChallengeInbox from "@/components/ChallengeInbox";
import type { Challenge } from "@/lib/types";

export default async function ChallengesPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    supabase
      .from("challenges")
      .select("*, challenger:profiles!challenges_challenger_id_fkey(username)")
      .eq("opponent_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("challenges")
      .select("*, opponent:profiles!challenges_opponent_id_fkey(username)")
      .eq("challenger_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/matchups" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Are You Bout That?
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Challenges you&apos;ve sent and received.
      </p>

      <ChallengeInbox
        incoming={(incoming ?? []) as Challenge[]}
        outgoing={(outgoing ?? []) as Challenge[]}
      />
    </div>
  );
}
