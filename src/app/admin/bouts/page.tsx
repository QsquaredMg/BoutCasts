import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BracketBuilder from "@/components/BracketBuilder";
import BracketFromBouts from "@/components/BracketFromBouts";
import BoutCurator from "@/components/BoutCurator";

export default async function AdminBoutsPage() {
  const supabase = await createClient();

  const { data: subcategories } = await supabase.from("subcategories").select("*").order("sort_order");
  const [{ data: categories }, { data: submissionsRaw }, { data: usedRows }, { data: sponsors }, { data: bouts }] =
    await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase
        .from("submissions")
        .select("id, title, category_id, crew_name, source_type, source_url, created_at, profiles(username)")
        .eq("status", "approved")
        .order("created_at", { ascending: true }),
      supabase
        .from("bouts")
        .select("competitor_a_submission_id, competitor_b_submission_id"),
      supabase.from("sponsors").select("id, name").order("name"),
      supabase.from("bouts").select("*").order("created_at", { ascending: false }),
    ]);

  const usedIds = new Set<string>();
  for (const b of usedRows ?? []) {
    if (b.competitor_a_submission_id) usedIds.add(b.competitor_a_submission_id);
    if (b.competitor_b_submission_id) usedIds.add(b.competitor_b_submission_id);
  }

  const submissions = (submissionsRaw ?? []).map((s) => ({
    ...s,
    used: usedIds.has(s.id),
  }));

  // Everything created by organizers: competitions (categories) and showcases, drafts included.
  const [{ data: allCompetitions }, { data: allShowcases }] = await Promise.all([
    supabase.from("categories").select("id, name, owner_id, is_listed, created_at").order("created_at", { ascending: false }),
    supabase.from("showcases").select("id, title, kind, status, created_by, created_at, closes_at").order("created_at", { ascending: false }).limit(300),
  ]);
  const ownerIds = [
    ...new Set([...(allCompetitions ?? []).map((c) => c.owner_id), ...(allShowcases ?? []).map((x) => x.created_by)].filter((x): x is string => !!x)),
  ];
  const { data: ownerRows } = ownerIds.length ? await supabase.from("profiles").select("id, username").in("id", ownerIds) : { data: [] as { id: string; username: string | null }[] };
  const ownerName = new Map((ownerRows ?? []).map((o) => [o.id, o.username ?? "unknown"]));
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });

  const boutIds = (bouts ?? []).map((b) => b.id);
  const { data: votesRaw } =
    boutIds.length > 0
      ? await supabase.from("votes").select("bout_id, side").in("bout_id", boutIds)
      : { data: [] as { bout_id: string; side: string }[] };

  const tallyByBout = new Map<string, { a: number; b: number }>();
  for (const v of votesRaw ?? []) {
    const t = tallyByBout.get(v.bout_id) ?? { a: 0, b: 0 };
    t[v.side as "a" | "b"]++;
    tallyByBout.set(v.bout_id, t);
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Bouts &amp; brackets
        </h2>
        <span className="flex flex-wrap gap-2">
          <Link href="/showcase/new" className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">
            + Showcase (one video, many groups)
          </Link>
          <Link href="/showcase/new?kind=debate" className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
            + Panel debate
          </Link>
        </span>
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Curate individual bouts directly, or turn a set of approved submissions into a bracket.
      </p>

      <BoutCurator
        initialBouts={bouts ?? []}
        subcategories={subcategories ?? []}
        categories={categories ?? []}
        sponsors={sponsors ?? []}
        submissions={submissions}
        tallyByBout={Object.fromEntries(tallyByBout)}
      />

      <h2 className="mb-1 mt-12 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        All competitions ({(allCompetitions ?? []).length})
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--text-faint)" }}>Every competition hub, including unlisted ones. Open the hub to see it as a fan, or manage it as its organizer.</p>
      <div className="mb-10 flex flex-col gap-2">
        {(allCompetitions ?? []).length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>No competitions yet.</p>}
        {(allCompetitions ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.name}</p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                {c.owner_id ? `by ${ownerName.get(c.owner_id) ?? "unknown"}` : "BoutCasts"} · {c.is_listed ? "Listed" : "Unlisted"} · {when(c.created_at)}
              </p>
            </div>
            <span className="flex gap-2 text-xs font-semibold">
              <Link href={`/c/${c.id}`} className="rounded-full border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>Open hub</Link>
              <Link href={`/competitions/${c.id}`} className="rounded-full border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>Manage</Link>
            </span>
          </div>
        ))}
      </div>

      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        All showcases &amp; debates ({(allShowcases ?? []).length})
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--text-faint)" }}>Includes drafts and closed ones, so nothing gets lost.</p>
      <div className="flex flex-col gap-2">
        {(allShowcases ?? []).length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>No showcases yet.</p>}
        {(allShowcases ?? []).map((x) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{x.title}</p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                {x.kind === "debate" ? "Panel debate" : "Showcase"} · {x.status} · by {ownerName.get(x.created_by) ?? "unknown"} · {when(x.created_at)}
              </p>
            </div>
            <Link href={`/showcase/${x.id}`} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border)" }}>Open</Link>
          </div>
        ))}
      </div>

      <h2 className="mb-1 mt-12 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Build a bracket
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Turn a power-of-two set of approved submissions into a full tournament bracket.
      </p>
      <BracketBuilder categories={categories ?? []} submissions={submissions as never} />

      <BracketFromBouts
        categories={categories ?? []}
        bouts={(bouts ?? []).filter((b) => !b.bracket_key && !b.next_bout_id) as never}
      />
    </div>
  );
}
