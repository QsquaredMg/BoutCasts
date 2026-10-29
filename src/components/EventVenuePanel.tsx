"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import VenueFields, { EMPTY_VENUE, venueCols, type Venue } from "@/components/VenueFields";

// Organizer card on a Live Vote: set or change where it happens.
export default function EventVenuePanel({ eventId }: { eventId: string }) {
  const [v, setV] = useState<Venue>(EMPTY_VENUE);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("live_vote_events")
      .select("venue_name, venue_city, venue_state, venue_zip, venue_lat, venue_lng")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setV({ name: data.venue_name ?? "", city: data.venue_city ?? "", state: data.venue_state ?? "", zip: data.venue_zip ?? "", lat: data.venue_lat, lng: data.venue_lng });
        setReady(true);
      });
  }, [eventId]);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().from("live_vote_events").update(venueCols(v)).eq("id", eventId);
    setBusy(false);
    setMsg(error ? "Couldn't save the venue." : "Venue saved.");
  }

  if (!ready) return null;
  return (
    <section className="mb-6 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="mb-2 font-bold">Venue</h2>
      <VenueFields value={v} onChange={setV} />
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">{busy ? "Saving…" : "Save venue"}</button>
        {msg && <span role="status" className="text-sm">{msg}</span>}
      </div>
    </section>
  );
}
