import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SponsorManager from "@/components/SponsorManager";
import SponsorApplications from "@/components/SponsorApplications";

export default async function SponsorsAdminPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <p style={{ color: "var(--text-faint)" }}>You don&apos;t have access to this page.</p>
        <Link href="/" className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
          Back to matchups
        </Link>
      </div>
    );
  }

  const [{ data: sponsors }, { data: categories }, { data: bouts }, { data: boutsWithCat }, { data: votes }, { data: applications }] =
    await Promise.all([
      supabase.from("sponsors").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
      supabase
        .from("bouts")
        .select("id, title, status, sponsor_id")
        .order("created_at", { ascending: false }),
      supabase.from("bouts").select("id, sponsor_id, category_id"),
      supabase.from("votes").select("bout_id"),
      supabase
        .from("sponsor_applications")
        .select("id, company_name, website_url, contact_email, tier, plan_name, message, amount_paid, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);

  // Per-sponsor vote totals: a bout counts toward a sponsor if it's
  // sponsored directly, or its category is sponsored by them.
  const categorySponsorMap = new Map((categories ?? []).map((c) => [c.id, c.sponsor_id]));
  const votesByBout = new Map<string, number>();
  for (const v of votes ?? []) {
    votesByBout.set(v.bout_id, (votesByBout.get(v.bout_id) ?? 0) + 1);
  }
  const sponsorVoteTotals = new Map<string, number>();
  const sponsorBoutCounts = new Map<string, number>();
  for (const b of boutsWithCat ?? []) {
    const effectiveSponsor = b.sponsor_id ?? categorySponsorMap.get(b.category_id) ?? null;
    if (!effectiveSponsor) continue;
    sponsorVoteTotals.set(effectiveSponsor, (sponsorVoteTotals.get(effectiveSponsor) ?? 0) + (votesByBout.get(b.id) ?? 0));
    sponsorBoutCounts.set(effectiveSponsor, (sponsorBoutCounts.get(effectiveSponsor) ?? 0) + 1);
  }
  const maxVotes = Math.max(1, ...Array.from(sponsorVoteTotals.values()));

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Sponsors</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Manage sponsors and assign them to categories or individual bouts.
      </p>
      {(sponsors ?? []).length > 0 && (
        <div className="bc-card mb-8 p-5">
          <h2 className="mb-4 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Sponsor engagement
          </h2>
          <div className="flex flex-col gap-3">
            {(sponsors ?? []).map((s) => {
              const votesTotal = sponsorVoteTotals.get(s.id) ?? 0;
              const boutCount = sponsorBoutCounts.get(s.id) ?? 0;
              const pct = Math.round((votesTotal / maxVotes) * 100);
              return (
                <div key={s.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-bold">{s.name}</span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {boutCount} bout{boutCount === 1 ? "" : "s"} · {votesTotal} votes
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--blue)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SponsorApplications initial={applications ?? []} />

      <SponsorManager
        initialSponsors={sponsors ?? []}
        initialCategories={categories ?? []}
        initialBouts={bouts ?? []}
      />
    </div>
  );
}
