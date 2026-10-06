"use client";

import { useState } from "react";
import { money, SPONSOR_LEVEL_LABEL, type SponsorLevel } from "@/lib/eventSponsorships";

export type PublicPackage = { id: string; name: string; level: SponsorLevel; price_cents: number; perks: string | null; left: number };

export default function EventSponsorBuy({ packages }: { packages: PublicPackage[] }) {
  const [pick, setPick] = useState<string | null>(packages.find((p) => p.left > 0)?.id ?? null);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [logo, setLogo] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/event-sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pick, company, email, link, logo, accepted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.assign(data.url);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const input = "w-full rounded-lg border px-3 py-2 text-sm";
  const style = { borderColor: "var(--border)", background: "var(--surface)" };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {packages.map((p) => (
          <label key={p.id} className="flex cursor-pointer gap-3 rounded-xl border p-3" style={{ ...style, opacity: p.left > 0 ? 1 : 0.5 }}>
            <input type="radio" name="pkg" disabled={p.left <= 0} checked={pick === p.id} onChange={() => setPick(p.id)} />
            <span className="text-sm">
              <span className="font-semibold">{p.name}</span> · {money(p.price_cents)} · {SPONSOR_LEVEL_LABEL[p.level]}
              <span className="block" style={{ color: "var(--text-dim)" }}>
                {p.left > 0 ? `${p.left} left` : "Sold out"}
                {p.perks ? ` · ${p.perks}` : ""}
              </span>
            </span>
          </label>
        ))}
      </div>
      <input className={input} style={style} placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
      <input className={input} style={style} type="email" placeholder="Contact email (receipt goes here)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} style={style} placeholder="Website (https://…) optional" value={link} onChange={(e) => setLink(e.target.value)} />
      <input className={input} style={style} placeholder="Logo image link (https://…) optional" value={logo} onChange={(e) => setLogo(e.target.value)} />
      <label className="flex gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>
          I understand the organizer reviews every sponsor before the logo appears, and my payment is refunded in full if it&apos;s declined or the package sells out.
        </span>
      </label>
      {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="button" disabled={busy || !pick || !accepted} onClick={pay} className="w-full rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--red)" }}>
        {busy ? "Opening checkout…" : "Pay & sponsor"}
      </button>
    </div>
  );
}
