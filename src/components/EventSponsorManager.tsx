"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FileUploadPicker from "@/components/FileUploadPicker";

// Organizer's own sponsor banners for their event room (paid tiers, max 6).
type Sponsor = { id: string; name: string; logo_url: string | null; link_url: string | null };

export default function EventSponsorManager({ eventId, editable }: { eventId: string; editable: boolean }) {
  const supabase = createClient();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("live_vote_sponsors")
      .select("id, name, logo_url, link_url")
      .eq("event_id", eventId)
      .order("sort_order");
    setSponsors(data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let url = link.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    setBusy(true);
    const { error: insError } = await supabase.from("live_vote_sponsors").insert({
      event_id: eventId,
      name: name.trim(),
      link_url: url || null,
      logo_url: logo,
      sort_order: sponsors.length,
    });
    setBusy(false);
    if (insError) {
      setError(insError.message.includes("row-level security") ? "You can add up to 6 sponsors on paid events." : insError.message);
      return;
    }
    setName("");
    setLink("");
    setLogo(null);
    load();
  }

  async function remove(id: string) {
    await supabase.from("live_vote_sponsors").delete().eq("id", id);
    load();
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const input = "w-full rounded-[10px] border px-3 py-2 text-sm";

  return (
    <div className="mb-4 rounded-xl border p-3.5" style={box}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Sponsor banners ({sponsors.length}/6)
      </p>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
        Show your own sponsors on your voting page — logos link to their sites.
      </p>

      {sponsors.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {sponsors.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold" style={{ background: "var(--surface-2)" }}>
                  {s.name.slice(0, 1)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                {s.link_url && (
                  <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {s.link_url.replace(/^https?:\/\//, "")}
                  </span>
                )}
              </span>
              {editable && (
                <button type="button" onClick={() => remove(s.id)} className="px-1 text-xs" style={{ color: "var(--text-faint)" }} aria-label={`Remove ${s.name}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && sponsors.length < 6 && (
        <form onSubmit={add} className="flex flex-col gap-2">
          <input className={input} style={box} placeholder="Sponsor name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <input className={input} style={box} placeholder="Website (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
          {logo ? (
            <div className="flex items-center gap-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="h-10 w-10 rounded border object-contain" style={{ borderColor: "var(--border)" }} />
              <button type="button" onClick={() => setLogo(null)} style={{ color: "var(--text-faint)" }}>
                Remove logo
              </button>
            </div>
          ) : (
            <FileUploadPicker onUploaded={setLogo} />
          )}
          <button type="submit" disabled={busy || !name.trim()} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
            {busy ? "Adding…" : "Add sponsor"}
          </button>
          {error && (
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
