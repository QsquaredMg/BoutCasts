"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageField from "@/components/ImageField";
import { contrastRatio } from "@/lib/liveVoteEvents/roomTheme";

// Brand a trivia pack: name, logo, accent color, background color and photo (with strength).
// It shows on the projector screen and on every player's phone for any game hosted from this pack.
type Look = {
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_color: string | null;
  brand_bg_color: string | null;
  brand_bg_image_url: string | null;
  screen_bg_opacity: number;
};
const COLS = "brand_name, brand_logo_url, brand_color, brand_bg_color, brand_bg_image_url, screen_bg_opacity";

export default function TriviaBrandingEditor({ packId }: { packId: string }) {
  const [look, setLook] = useState<Look | null>(null);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    createClient()
      .from("trivia_packs")
      .select(COLS)
      .eq("id", packId)
      .maybeSingle()
      .then(({ data, error }) => {
        // Before the branding SQL has been run the columns don't exist: hide the section.
        if (error) setMissing(true);
        else if (data) setLook(data as Look);
      });
  }, [packId]);

  if (missing || !look) return null;
  const set = (v: Partial<Look>) => setLook((l) => (l ? { ...l, ...v } : l));
  const box = { borderColor: "var(--border)" };
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide";
  const bgTooLight = !!look.brand_bg_color && contrastRatio(look.brand_bg_color, "#ffffff") < 3;

  async function save() {
    if (!look) return;
    setBusy(true);
    setMsg(null);
    const { error } = await createClient()
      .from("trivia_packs")
      .update({
        brand_name: look.brand_name?.trim() || null,
        brand_logo_url: look.brand_logo_url || null,
        brand_color: look.brand_color,
        brand_bg_color: look.brand_bg_color,
        brand_bg_image_url: look.brand_bg_image_url || null,
        screen_bg_opacity: look.screen_bg_opacity,
      })
      .eq("id", packId);
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Saved. Your next live game uses this look; a game already running picks it up within a couple of seconds." });
  }

  const colorRow = (text: string, key: "brand_color" | "brand_bg_color", dflt: string, hint: string) => (
    <div>
      <span className={label}>{text}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={look[key] ?? dflt} onChange={(e) => set({ [key]: e.target.value } as Partial<Look>)} className="h-9 w-12 cursor-pointer rounded border" style={box} aria-label={text} />
        {look[key] ? (
          <button type="button" onClick={() => set({ [key]: null } as Partial<Look>)} className="text-xs underline">Use default</button>
        ) : (
          <span className="text-[11px] opacity-60">{hint}</span>
        )}
      </div>
    </div>
  );

  return (
    <section className="mt-5 rounded-2xl border p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
        <span>
          <span className="block font-bold">🎨 Brand this trivia</span>
          <span className="block text-xs opacity-70">Logo, colors and a background photo on the big screen and on players&apos; phones</span>
        </span>
        <span className="text-sm font-bold">{open ? "Close" : "Edit"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={label}>Sponsor or brand name</span>
            <input
              value={look.brand_name ?? ""}
              onChange={(e) => set({ brand_name: e.target.value })}
              maxLength={60}
              placeholder="e.g. Pizza Hut"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <div>
            <span className={label}>Logo</span>
            <ImageField value={look.brand_logo_url} onChange={(v) => set({ brand_logo_url: v })} label="logo" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {colorRow("Accent color", "brand_color", "#ffc531", "Timer, scores, buttons")}
            {colorRow("Background color", "brand_bg_color", "#2a1260", "Behind the questions")}
          </div>
          {bgTooLight && <p className="text-xs" style={{ color: "var(--danger)" }}>That background is too light for white text, so it will be ignored. Pick a darker one.</p>}
          <div>
            <span className={label}>Background photo</span>
            <ImageField value={look.brand_bg_image_url} onChange={(v) => set({ brand_bg_image_url: v })} label="background" wide />
          </div>
          {look.brand_bg_image_url && (
            <div>
              <span className={label}>Photo strength: {look.screen_bg_opacity}%</span>
              <input type="range" min={0} max={100} step={5} value={look.screen_bg_opacity} onChange={(e) => set({ screen_bg_opacity: Number(e.target.value) })} className="w-full" aria-label="Background photo strength" />
              <span className="text-[11px] opacity-70">The photo sits over your background color. Lower it so questions and answers stay easy to read.</span>
              <div className="relative mt-2 h-16 overflow-hidden rounded-lg border" style={{ ...box, background: look.brand_bg_color && !bgTooLight ? look.brand_bg_color : "#1b0f3d" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${look.brand_bg_image_url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: look.screen_bg_opacity / 100 }} />
              </div>
            </div>
          )}
          <button type="button" onClick={save} disabled={busy} className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: "#1b4fe4" }}>
            {busy ? "Saving…" : "Save look"}
          </button>
          {msg && <p className="text-xs" style={{ color: msg.ok ? undefined : "var(--danger)" }}>{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
