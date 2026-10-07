"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORGANIZER_GOLD } from "@/lib/liveVoteEvents/tiers";
import { money, splitSponsorship, SPONSOR_LEVEL_LABEL, type SponsorLevel } from "@/lib/eventSponsorships";

type Pkg = { id: string; name: string; level: SponsorLevel; price_cents: number; slots: number; perks: string | null; active: boolean };
type Sale = {
  id: string; company_name: string; contact_email: string; logo_url: string | null; link_url: string | null; level: SponsorLevel;
  gross_cents: number; organizer_share_cents: number; status: "pending" | "approved" | "declined"; organizer_payout_status: "pending" | "paid";
};

// Gold organizers sell sponsor packages here; everyone else sees the upgrade.
export default function EventSponsorSales({ eventId, editable }: { eventId: string; editable: boolean }) {
  const supabase = createClient();
  const [gold, setGold] = useState<boolean | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<SponsorLevel>("supporter");
  const [price, setPrice] = useState("");
  const [slots, setSlots] = useState("1");
  const [perks, setPerks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const { data: g } = await supabase.rpc("organizer_is_gold", { p_user: uid });
    setGold(g === true);
    const { data: p } = await supabase.from("event_sponsor_packages").select("id, name, level, price_cents, slots, perks, active").eq("event_id", eventId).order("price_cents", { ascending: false });
    setPkgs((p ?? []) as Pkg[]);
    const { data: s } = await supabase.from("event_sponsorships").select("id, company_name, contact_email, logo_url, link_url, level, gross_cents, organizer_share_cents, status, organizer_payout_status").eq("event_id", eventId).order("created_at");
    setSales((s ?? []) as Sale[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function call(body: Record<string, unknown>, path = "/api/event-sponsorships") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (data.url) window.location.assign(data.url);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (gold === null) return null;
  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const input = "w-full rounded-lg border px-3 py-2 text-sm";

  if (!gold) {
    return (
      <div className="mt-6 rounded-xl border p-4" style={box}>
        <p className="font-semibold">Sell your own sponsors with Organizer Gold</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Offer sponsor packages for this event. Sponsors pay by card through BoutCasts, you approve each logo, and you receive {100 - ORGANIZER_GOLD.platformFeePct}% of every sponsorship after the event closes
          (BoutCasts keeps {ORGANIZER_GOLD.platformFeePct}%). {money(ORGANIZER_GOLD.priceCents)}/month, includes Organizer Pro.
        </p>
        {error && <p className="mt-2 text-sm" style={{ color: "var(--red)" }}>{error}</p>}
        <button type="button" disabled={busy} onClick={() => call({}, "/api/checkout/organizer-gold")} className="mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--red)" }}>
          Get Organizer Gold
        </button>
      </div>
    );
  }

  const cents = Math.round(Number(price.replace(/[$,\s]/g, "")) * 100);
  const preview = Number.isFinite(cents) && cents > 0 ? splitSponsorship(cents) : null;
  return (
    <div className="mt-6 space-y-4 rounded-xl border p-4" style={box}>
      <div>
        <p className="font-semibold">Sell sponsor packages</p>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Sponsors pay BoutCasts. BoutCasts keeps {ORGANIZER_GOLD.platformFeePct}%; you get {100 - ORGANIZER_GOLD.platformFeePct}% after the event closes. You approve each sponsor before the logo appears; declined sponsors are refunded in full.
        </p>
        <p className="mt-1 text-sm">
          Share this link with businesses: <code className="break-all">{typeof window !== "undefined" ? `${window.location.origin}/live-vote/${eventId}/sponsor` : `/live-vote/${eventId}/sponsor`}</code>
        </p>
      </div>
      {pkgs.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            <strong>{p.name}</strong> · {money(p.price_cents)} × {p.slots} · {SPONSOR_LEVEL_LABEL[p.level]} {p.active ? "" : "(off)"}
          </span>
          {editable && (
            <button type="button" disabled={busy} className="underline" onClick={() => call({ action: "toggle_package", packageId: p.id, active: !p.active })}>
              {p.active ? "Turn off" : "Turn on"}
            </button>
          )}
        </div>
      ))}
      {editable && (
        <div className="space-y-2">
          <input className={input} style={box} placeholder="Package name (e.g. Gold sponsor)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <div className="flex gap-2">
            <select className={input} style={box} value={level} onChange={(e) => setLevel(e.target.value as SponsorLevel)}>
              <option value="title">Title sponsor</option><option value="gold">Gold</option><option value="supporter">Supporter</option>
            </select>
            <input className={input} style={box} placeholder="Price $" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
            <input className={input} style={box} placeholder="Spots" value={slots} onChange={(e) => setSlots(e.target.value)} inputMode="numeric" />
          </div>
          <input className={input} style={box} placeholder="What sponsors get (optional)" value={perks} onChange={(e) => setPerks(e.target.value)} maxLength={500} />
          {preview && <p className="text-xs" style={{ color: "var(--text-dim)" }}>Per sale: you receive {money(preview.organizer)}, BoutCasts keeps {money(preview.fee)}.</p>}
          <button type="button" disabled={busy || !name.trim() || !preview} className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--red)" }}
            onClick={async () => { await call({ action: "create_package", eventId, name, level, priceCents: cents, slots: Number(slots) || 1, perks }); setName(""); setPrice(""); setPerks(""); }}>
            Add package
          </button>
        </div>
      )}
      {sales.length > 0 && (
        <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold">Sponsors</p>
          {sales.map((s) => (
            <div key={s.id} className="text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{s.company_name}</strong> · {money(s.gross_cents)} (you: {money(s.organizer_share_cents)}) ·{" "}
                  {s.status === "approved" ? (s.organizer_payout_status === "paid" ? "approved, paid out" : "approved, paid after event closes") : s.status}
                </span>
                {s.status === "pending" && (
                  <span className="flex gap-3">
                    <button type="button" disabled={busy} className="font-semibold underline" onClick={() => call({ action: "approve", id: s.id })}>Approve</button>
                    <button type="button" disabled={busy} className="underline" onClick={() => confirm(`Decline ${s.company_name} and refund ${money(s.gross_cents)}?`) && call({ action: "decline", id: s.id })}>Decline & refund</button>
                  </span>
                )}
              </div>
              {s.status === "pending" && s.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt={`${s.company_name} logo`} className="mt-1 h-12 rounded border object-contain" style={{ borderColor: "var(--border)" }} />
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
    </div>
  );
}
