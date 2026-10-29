import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { getEmbedInfo } from "@/lib/clipSource";
import { notFound } from "next/navigation";
import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, type ElectionRow } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Public campaign page: every candidate's photo, pitch, slogan and platform, by office. It shows no vote counts.
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = createAdminClient();
  const { data } = await admin.from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = data as ElectionRow | null;
  if (!election || !election.campaign_page_enabled) notFound();

  const { data: races } = await admin.from("live_vote_events").select("id, title, election_sort").eq("election_id", id).order("election_sort");
  const raceIds = (races ?? []).map((r) => r.id);
  const [{ data: options }, { data: profiles }] = await Promise.all([
    raceIds.length ? admin.from("live_vote_options").select("id, event_id, name, description, image_url, source_type, source_url, sort_order").in("event_id", raceIds).order("sort_order") : Promise.resolve({ data: [] }),
    admin.from("election_candidate_profiles").select("option_id, slogan, platform").eq("election_id", id),
  ]);
  const byOption = new Map((profiles ?? []).map((p) => [p.option_id, p]));
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{election.school_name ?? "School election"}</p>
        <h1 className="text-3xl font-extrabold">Meet the candidates</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>{election.title}. Read each platform, then ask: what can this office really do, and which promises can be checked?</p>
        <div className="mt-6 grid gap-8">
          {(races ?? []).map((r) => (
            <section key={r.id}>
              <h2 className="mb-3 text-xl font-extrabold">{r.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {(options ?? []).filter((o) => o.event_id === r.id).map((o) => {
                  const p = byOption.get(o.id);
                  return (
                    <article key={o.id} className="rounded-xl border p-4" style={box}>
                      {o.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.image_url} alt={o.name} className="mb-3 h-40 w-full rounded-lg object-cover" />
                      )}
                      <h3 className="text-lg font-bold">{o.name}</h3>
                      {p?.slogan && <p className="text-sm font-semibold italic">&ldquo;{p.slogan}&rdquo;</p>}
                      {o.description && <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>{o.description}</p>}
                      {p && p.platform.length > 0 && (
                        <ol className="mt-2 list-decimal pl-5 text-sm">
                          {p.platform.map((pt: string, i: number) => <li key={i}>{pt}</li>)}
                        </ol>
                      )}
                      {o.source_url && o.source_type === "link" && getEmbedInfo(o.source_url) ? (
                        <div className="mt-3"><EmbeddedClipPlayer sourceUrl={o.source_url} label={`${o.name} video`} privacy /></div>
                      ) : o.source_url && (o.source_type === "upload" || o.source_type === "record") ? (
                        <video src={o.source_url} controls playsInline preload="none" className="mt-3 w-full rounded-lg bg-black" aria-label={`${o.name} speech`} />
                      ) : o.source_url ? (
                        <a href={o.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold underline">Watch the candidate video</a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </ElectionBrandFrame>
  );
}
