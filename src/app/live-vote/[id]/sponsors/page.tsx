import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";

export const metadata: Metadata = { title: "Sponsor report", robots: { index: false } };

type Report = {
  event: { id: string; title: string; status: string; is_private: boolean; brand_name: string | null; closes_at: string | null; created_at: string };
  views: number;
  votes: number;
  raised_cents: number;
  sponsors: { id: string; name: string; logo_url: string | null; link_url: string | null; level: "title" | "gold" | "supporter"; amount_cents: number | null; clicks: number }[];
};

const LEVEL = { title: "Title sponsor", gold: "Gold sponsor", supporter: "Supporter" } as const;

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Organizer's fundraising summary + a page they can print/save as PDF and send
// to each sponsor showing how many people saw their logo.
export default async function EventSponsorReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(`/live-vote/${id}/sponsors`)}`);
  const { data, error } = await supabase.rpc("get_event_sponsor_report", { p_event_id: id });
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10 text-sm" style={{ color: "var(--text-dim)" }}>
        Only the event organizer can see this report.{" "}
        <Link href={`/live-vote/${id}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
          Back to event
        </Link>
      </div>
    );
  }
  const r = data as Report;
  const when = new Date(r.event.closes_at ?? r.event.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="sponsor-report mx-auto max-w-3xl px-5 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/live-vote/${id}`} className="text-sm font-semibold" style={{ color: "var(--red)" }}>
          ← Back to event
        </Link>
        <PrintButton />
      </div>

      {/* Organizer-only fundraising summary (not printed). */}
      <div className="mb-6 grid grid-cols-3 gap-3 print:hidden">
        {[
          ["Raised from sponsors", dollars(r.raised_cents)],
          ["Sponsors", String(r.sponsors.length)],
          ["Votes cast", r.votes.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              {label}
            </div>
            <div className="mt-1 text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
              {value}
            </div>
          </div>
        ))}
      </div>
      <p className="mb-3 text-xs print:hidden" style={{ color: "var(--text-faint)" }}>
        The report below is what sponsors see. It doesn&apos;t show pledge amounts. Print it or save it as a PDF and send it with your thank-you note.
      </p>

      <div className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
          Sponsor results · {when}
        </p>
        <h1 className="mt-1 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {r.event.title}
        </h1>
        {r.event.brand_name && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Hosted by {r.event.brand_name}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Voting page visits
            </div>
            <div className="mt-1 text-3xl font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {r.views.toLocaleString()}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              each visit showed every sponsor logo
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Votes cast
            </div>
            <div className="mt-1 text-3xl font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {r.votes.toLocaleString()}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              people engaged on the page
            </div>
          </div>
        </div>

        <h2 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Thank you to our sponsors
        </h2>
        {r.sponsors.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            No sponsors added yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {r.sponsors.map((s) => (
              <div key={s.id} className="flex items-center gap-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex h-12 w-24 flex-shrink-0 items-center justify-center">
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo_url} alt="" className="max-h-12 max-w-24 object-contain" />
                  ) : (
                    <span className="text-sm font-black">{s.name}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{s.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {LEVEL[s.level]}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-bold tabular-nums">{r.views.toLocaleString()} views</div>
                  {s.link_url && (
                    <div className="text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
                      {s.clicks.toLocaleString()} visits to your website
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-[11px]" style={{ color: "var(--text-faint)" }}>
          Counted by BoutCasts. A visit is one person opening the voting page in a browser session.
          {r.event.is_private ? " This was a private event, shared only with the school or group's own community." : ""}
        </p>
      </div>
    </div>
  );
}
