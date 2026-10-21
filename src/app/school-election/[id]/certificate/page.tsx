import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { requireElectionOwner } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Printable certificate of results for a certified election. Organizer only.
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) notFound();
  const { admin, election } = owner;
  if (election.status !== "closed" || !election.certified_at || election.is_practice) notFound();

  const [{ data: races }, { count: total }, { count: voted }] = await Promise.all([
    admin.from("live_vote_events").select("id, title").eq("election_id", id).order("election_sort"),
    admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id),
    admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id).not("voted_at", "is", null),
  ]);
  const rows: { office: string; winners: string; votes: number }[] = [];
  for (const r of races ?? []) {
    const [{ data: opts }, { data: tally }] = await Promise.all([
      admin.from("live_vote_options").select("id, name").eq("event_id", r.id),
      admin.rpc("get_live_vote_tally", { p_event_id: r.id }),
    ]);
    const counts = new Map<string, number>(((tally ?? []) as { option_id: string; votes: number | string }[]).map((t) => [t.option_id, Number(t.votes)]));
    const top = Math.max(0, ...(opts ?? []).map((o) => counts.get(o.id) ?? 0));
    const w = top > 0 ? (opts ?? []).filter((o) => (counts.get(o.id) ?? 0) === top) : [];
    rows.push({ office: r.title, winners: w.length ? w.map((o) => o.name).join(" & ") + (w.length > 1 ? " (tie)" : "") : "No votes cast", votes: top });
  }
  const date = new Date(election.certified_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex gap-3 print:hidden"><PrintButton label="Print certificate" /></div>
      <div className="rounded-xl border-4 p-10 text-center" style={{ borderColor: "#111", background: "#fff", color: "#111" }}>
        {election.school_name && <p className="text-sm font-bold uppercase tracking-[0.2em]">{election.school_name}</p>}
        <h1 className="mt-2 text-3xl font-extrabold">{election.title}</h1>
        <p className="mt-1 text-lg font-semibold">Certificate of Election Results</p>
        <p className="mt-4 text-sm">{(voted ?? 0).toLocaleString()} of {(total ?? 0).toLocaleString()} eligible students voted.</p>
        <div className="mt-6 grid gap-3 text-left">
          {rows.map((r) => (
            <div key={r.office} className="border-b pb-2" style={{ borderColor: "#bbb" }}>
              <p className="text-xs font-bold uppercase tracking-wide">{r.office}</p>
              <p className="text-xl font-extrabold">{r.winners}{election.show_tally && r.votes > 0 ? <span className="text-sm font-semibold"> · {r.votes} vote{r.votes === 1 ? "" : "s"}</span> : null}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm">Certified on {date}.</p>
        {election.certified_note && <p className="mt-1 text-sm italic">{election.certified_note}</p>}
        <div className="mt-10 grid grid-cols-2 gap-10 text-xs">
          <div className="border-t pt-1" style={{ borderColor: "#111" }}>Election official</div>
          <div className="border-t pt-1" style={{ borderColor: "#111" }}>Faculty advisor</div>
        </div>
      </div>
    </div>
  );
}
