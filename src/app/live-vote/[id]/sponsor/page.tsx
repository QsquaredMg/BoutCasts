import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import EventSponsorBuy, { type PublicPackage } from "@/components/EventSponsorBuy";
import type { SponsorLevel } from "@/lib/eventSponsorships";

export const metadata = { title: "Sponsor this event" };

export default async function SponsorEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const admin = createAdminClient();
  const { data: ev } = await admin.from("live_vote_events").select("id, title, status, organizer_id").eq("id", id).maybeSingle();
  if (!ev) notFound();
  const { data: gold } = await admin.rpc("organizer_is_gold", { p_user: ev.organizer_id });
  const open = gold === true && ev.status !== "closed";

  const { data: pks } = open
    ? await admin.from("event_sponsor_packages").select("id, name, level, price_cents, slots, perks").eq("event_id", id).eq("active", true).order("price_cents", { ascending: false })
    : { data: [] };
  const { data: taken } = await admin.from("event_sponsorships").select("package_id").eq("event_id", id).neq("status", "declined");
  const used = new Map<string, number>();
  for (const t of taken ?? []) used.set(t.package_id, (used.get(t.package_id) ?? 0) + 1);
  const packages: PublicPackage[] = (pks ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    level: p.level as SponsorLevel,
    price_cents: p.price_cents,
    perks: p.perks,
    left: Math.max(0, p.slots - (used.get(p.id) ?? 0)),
  }));

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <h1 className="text-2xl font-bold">Sponsor {ev.title}</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
        Put your logo in front of everyone voting. Your payment is processed by BoutCasts; the organizer approves your logo before it goes live, and you&apos;re refunded in full if it&apos;s declined.
      </p>
      {checkout === "success" && (
        <p className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
          Thank you! Your payment went through. You&apos;ll appear on the event once the organizer approves.
        </p>
      )}
      <div className="mt-6">
        {packages.length > 0 ? (
          <EventSponsorBuy packages={packages} />
        ) : (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>Sponsorships aren&apos;t open for this event.</p>
        )}
      </div>
      <Link href={`/live-vote/${id}`} className="mt-6 inline-block text-sm underline">← Back to the event</Link>
    </div>
  );
}
