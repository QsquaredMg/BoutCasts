"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageField from "@/components/ImageField";
import type { PredSlate } from "@/lib/predictions/types";

// Paid brackets: your name, logo and color, plus white label (no BoutCasts logo or credit).
export default function PredBrandingEditor({ slate }: { slate: PredSlate }) {
  const router = useRouter();
  const [name, setName] = useState(slate.brand_name ?? "");
  const [logo, setLogo] = useState<string | null>(slate.brand_logo_url);
  const [color, setColor] = useState<string | null>(slate.brand_color);
  const [white, setWhite] = useState(slate.white_label);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().rpc("set_pred_branding", { p_id: slate.id, p_brand_name: name, p_logo: logo ?? "", p_color: color, p_white_label: white });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Saved." });
    if (!error) router.refresh();
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const label = "mb-1 block text-xs font-semibold";
  return (
    <div className="bc-card mb-6 p-5">
      <h2 className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Branding &amp; white label</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>Show your own name, logo and color on the bracket page and the winners graphic.</p>
      <div className="flex flex-col gap-4">
        <div>
          <span className={label} style={{ color: "var(--text-dim)" }}>Organization name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-full rounded-[10px] border px-3 py-2 text-sm" style={box} placeholder="e.g. Eastside High Athletics" />
        </div>
        <div>
          <span className={label} style={{ color: "var(--text-dim)" }}>Logo</span>
          <ImageField value={logo} onChange={setLogo} label="logo" />
        </div>
        <div>
          <span className={label} style={{ color: "var(--text-dim)" }}>Accent color (winners graphic background)</span>
          <div className="flex items-center gap-2">
            <input type="color" value={color ?? "#1b4fe4"} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} aria-label="Accent color" />
            {color ? <button type="button" onClick={() => setColor(null)} className="text-xs underline" style={{ color: "var(--text-faint)" }}>Reset</button> : <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>Default</span>}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={white} onChange={(e) => setWhite(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="block font-semibold">White label</span>
            <span className="block text-xs" style={{ color: "var(--text-faint)" }}>Replaces the BoutCasts logo and credit on the winners graphic and bracket header with your name and logo. Requires an organization name.</span>
          </span>
        </label>
        <button type="button" onClick={save} disabled={busy} className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60">{busy ? "Saving…" : "Save branding"}</button>
        {msg && <p role="status" className="text-sm font-semibold" style={{ color: msg.ok ? "var(--blue)" : "var(--red)" }}>{msg.text}</p>}
      </div>
    </div>
  );
}
