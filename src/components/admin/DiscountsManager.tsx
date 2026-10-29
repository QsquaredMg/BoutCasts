"use client";

import { useCallback, useEffect, useState } from "react";

type Code = { id: string; code: string; active: boolean; percentOff: number | null; amountOffCents: number | null; timesRedeemed: number; maxRedemptions: number | null; expiresAt: number | null };

const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;
const inp = "rounded border px-3 py-2 text-sm";

export default function DiscountsManager() {
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/promo-codes").then((x) => x.json()).catch(() => ({ error: "Could not load codes." }));
    if (r.error) setErr(r.error);
    else setCodes(r.codes);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-10">
      <PromoSection codes={codes} err={err} reload={load} />
      <LinkSection />
    </div>
  );
}

function PromoSection({ codes, err, reload }: { codes: Code[] | null; err: string | null; reload: () => void }) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [max, setMax] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    const n = Number(value);
    const r = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        ...(kind === "percent" ? { percentOff: n } : { amountOffCents: Math.round(n * 100) }),
        maxRedemptions: max ? Number(max) : undefined,
        // datetime-local has no zone; convert here so it is the admin's own local time, not the server's.
        expiresAt: expires ? new Date(expires).toISOString() : undefined,
      }),
    }).then((x) => x.json()).catch(() => ({ error: "Network problem." }));
    setBusy(false);
    if (r.ok) {
      setMsg(`Created ${code.toUpperCase()}.`);
      setCode(""); setValue(""); setMax(""); setExpires("");
      reload();
    } else setMsg(r.error ?? "Could not create the code.");
  }

  async function off(id: string) {
    await fetch("/api/admin/promo-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deactivate", id }) });
    reload();
  }

  return (
    <section>
      <h3 className="mb-2 text-base font-bold">Promo codes</h3>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3" style={box}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE (e.g. LAUNCH50)" className={inp} style={box} aria-label="Code" />
        <select value={kind} onChange={(e) => setKind(e.target.value as "percent" | "amount")} className={inp} style={box} aria-label="Discount type">
          <option value="percent">% off</option>
          <option value="amount">$ off</option>
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} type="number" min="1" step={kind === "percent" ? "1" : "0.01"} placeholder={kind === "percent" ? "50" : "10.00"} className={`${inp} w-24`} style={box} aria-label="Amount" />
        <input value={max} onChange={(e) => setMax(e.target.value)} type="number" min="1" placeholder="Limit uses" className={`${inp} w-28`} style={box} aria-label="Limit uses" />
        <input value={expires} onChange={(e) => setExpires(e.target.value)} type="datetime-local" className={inp} style={box} aria-label="Expires" title="Expires (optional)" />
        <button type="button" onClick={create} disabled={busy || !code || !value} className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--red)" }}>Create code</button>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      {err && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="mt-3 flex flex-col gap-1.5">
        {codes?.length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>No codes yet.</p>}
        {codes?.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ ...box, opacity: c.active ? 1 : 0.55 }}>
            <span>
              <strong>{c.code}</strong>{" "}
              {c.percentOff != null ? `${c.percentOff}% off` : `$${((c.amountOffCents ?? 0) / 100).toFixed(2)} off`}
              <span style={{ color: "var(--text-faint)" }}>
                {" "}· used {c.timesRedeemed}{c.maxRedemptions ? ` of ${c.maxRedemptions}` : ""}
                {c.expiresAt ? ` · expires ${new Date(c.expiresAt * 1000).toLocaleDateString()}` : ""}
                {!c.active ? " · off" : ""}
              </span>
            </span>
            {c.active && <button type="button" onClick={() => off(c.id)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Turn off</button>}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>Buyers see an &ldquo;Add promotion code&rdquo; link at checkout. Codes work on organizer purchases, not on fan Super Votes, paid bout entries, donations or event sponsorships (the organizer&rsquo;s share is based on the full package price).</p>
    </section>
  );
}

function LinkSection() {
  const [product, setProduct] = useState("custom");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("1");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const needs = product === "pred_bracket_upgrade" ? "game" : product === "custom" ? null : "event";

  async function make() {
    setBusy(true);
    setRes(null);
    const r = await fetch("/api/admin/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, targetId: target.trim(), days: Number(days), amountCents: Math.round(Number(price) * 100), description: desc, buyerEmail: email }),
    }).then((x) => x.json()).catch(() => ({ error: "Network problem." }));
    setBusy(false);
    setRes(r.ok ? { ok: true, text: r.url } : { ok: false, text: r.error ?? "Could not create the link." });
  }

  return (
    <section>
      <h3 className="mb-2 text-base font-bold">Payment link at your price</h3>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3" style={box}>
        <select value={product} onChange={(e) => setProduct(e.target.value)} className={inp} style={box} aria-label="What is being sold">
          <option value="custom">Custom payment (nothing applied automatically)</option>
          <option value="live_vote_pro">Live Vote Pro upgrade</option>
          <option value="super_votes_unlock">Super Votes unlock</option>
          <option value="time_addon">Live Vote extra time</option>
          <option value="pred_bracket_upgrade">Prediction game upgrade</option>
        </select>
        {needs && <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={`${needs === "game" ? "Game" : "Event"} ID`} className={`${inp} w-72`} style={box} aria-label="Target ID" />}
        {product === "time_addon" && <input value={days} onChange={(e) => setDays(e.target.value)} type="number" min="1" max="14" className={`${inp} w-20`} style={box} aria-label="Days" title="Days" />}
        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0.5" step="0.01" placeholder="Price $" className={`${inp} w-28`} style={box} aria-label="Price" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description buyer sees" className={`${inp} w-56`} style={box} aria-label="Description" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Buyer email (optional)" className={`${inp} w-56`} style={box} aria-label="Buyer email" />
        <button type="button" onClick={make} disabled={busy || !price} className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--red)" }}>Create link</button>
      </div>
      {res && (
        <p className="mt-2 break-all text-sm" style={{ color: res.ok ? undefined : "var(--danger)" }}>
          {res.ok ? <>Send this to the buyer (good for 24 hours): <a href={res.text} className="underline" target="_blank" rel="noreferrer">{res.text}</a></> : res.text}
        </p>
      )}
      <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>Upgrades apply automatically once the buyer pays, and the sale shows on Purchases. Event and game IDs are in the page address of that event or game.</p>
    </section>
  );
}
