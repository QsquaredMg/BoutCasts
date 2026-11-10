import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SponsorLibrary from "@/components/SponsorLibrary";

export const metadata: Metadata = { title: "My sponsors", robots: { index: false } };

export default async function Page() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user)
    return <div className="mx-auto max-w-2xl px-5 py-10"><Link href="/login?next=/sponsors" className="font-semibold underline">Sign in</Link> to manage your sponsors.</div>;
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>My sponsors</h1>
      <p className="mb-5 mt-1 text-sm opacity-80">
        Add a sponsor once, then place it on any of your trivia packs, live votes, prediction brackets or bouts, each with its own level and amount. Add an optional commercial. Views, taps and commercial plays are counted per placement. Amounts are only visible to you.
      </p>
      <SponsorLibrary />
    </div>
  );
}
