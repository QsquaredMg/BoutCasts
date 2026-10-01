import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import type { Instrumental } from "@/lib/types";

export const metadata: Metadata = { title: "Producer report" };

type BoutRow = {
  id: string; title: string; status: string; instrumental_id: string;
  competitor_a_name: string; competitor_b_name: string;
};

// Producer usage report: which bouts used a producer's beats, how many performers
// and votes they drew. Doubles as the pitch to a producer to become an organizer.
// Admin access is enforced by src/app/admin/layout.tsx.
export default async function ProducerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ producer?: string }>;
}) {
  const { producer = "" } = await searchParams;
  const supabase = await createClient();

  const { data: trackData } = await supabase.from("instrumentals").select("*").eq("status", "approved");
  const tracks = (trackData as Instrumental[] | null) ?? [];
  const producers = Array.from(new Set(tracks.map((t) => t.producer_name))).sort();

  const mine = tracks.filter((t) => t.producer_name === producer);
  const ids = mine.map((t) => t.id);

  let bouts: BoutRow[] = [];
  const votesByBout = new Map<string, number>();
  if (ids.length > 0) {
    const { data: boutData } = await supabase
      .from("bouts")
      .select("id, title, status, instrumental_id, competitor_a_name, competitor_b_name")
      .in("instrumental_id", ids);
    bouts = (boutData as BoutRow[] | null) ?? [];
    if (bouts.length > 0) {
      const { data: votes } = await supabase.from("votes").select("bout_id").in("bout_id", bouts.map((b) => b.id));
      for (const v of votes ?? []) votesByBout.set(v.bout_id, (votesByBout.get(v.bout_id) ?? 0) + 1);
    }
  }

  const trackTitle = new Map(mine.map((t) => [t.id, t.title]));
  const performers = new Set<string>();
  for (const b of bouts) {
    performers.add(b.competitor_a_name.trim().toLowerCase());
    performers.add(b.competitor_b_name.trim().toLowerCase());
  }
  const totalVotes = Array.from(votesByBout.values()).reduce((a, b) => a + b, 0);
  const ranked = [...bouts].sort((a, b) => (votesByBout.get(b.id) ?? 0) - (votesByBout.get(a.id) ?? 0));

  const stats: [string, string][] = [
    ["Approved tracks", String(mine.length)],
    ["Bouts using their beats", String(bouts.length)],
    ["Performers", String(performers.size)],
    ["Total votes", totalVotes.toLocaleString()],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/instrumentals" className="text-sm font-semibold" style={{ color: "var(--blue)" }}>
          &larr; Instrumentals
        </Link>
        {producer && <PrintButton />}
      </div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Producer report{producer ? `: ${producer}` : ""}
      </h2>

      <form method="get" className="mb-6 mt-3 flex gap-2 print:hidden">
        <select name="producer" defaultValue={producer} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <option value="">Choose a producer</option>
          {producers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button type="submit" className="bc-btn-red px-4 py-2 text-sm">View</button>
      </form>

      {!producer ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Pick a producer to see how their beats performed.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>{label}</div>
              </div>
            ))}
          </div>
          <h3 className="mb-2 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Top bouts</h3>
          {ranked.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>No bouts have used these beats yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {ranked.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <span>
                    <Link href={`/bout/${b.id}`} className="font-semibold underline">{b.title}</Link>
                    <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                      {b.competitor_a_name} vs {b.competitor_b_name} · {trackTitle.get(b.instrumental_id)} · {b.status}
                    </span>
                  </span>
                  <span className="font-bold">{(votesByBout.get(b.id) ?? 0).toLocaleString()} votes</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
