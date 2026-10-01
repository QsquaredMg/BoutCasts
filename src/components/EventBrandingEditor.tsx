"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageField from "@/components/ImageField";
import { contrastRatio } from "@/lib/liveVoteEvents/roomTheme";

// Organizer edits the event's look after creating it: cover photo for every
// event; logo, colors, background photo and white-label on paid sizes.
type Look = {
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_color: string | null;
  brand_bg_color: string | null;
  brand_bg_image_url: string | null;
  cover_image_url: string | null;
  white_label: boolean;
};

export default function EventBrandingEditor({
  eventId,
  isFree,
  isPrivate,
  editable,
}: {
  eventId: string;
  isFree: boolean;
  isPrivate: boolean;
  editable: boolean;
}) {
  const [look, setLook] = useState<Look | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    createClient()
      .from("live_vote_events")
      .select("brand_name, brand_logo_url, brand_color, brand_bg_color, brand_bg_image_url, cover_image_url, white_label")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data }) => setLook((data as Look) ?? null));
  }, [eventId]);

  if (!look) return null;
  const set = (patch: Partial<Look>) => setLook((l) => (l ? { ...l, ...patch } : l));

  async function save() {
    if (!look) return;
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().rpc("set_live_vote_branding", {
      p_event_id: eventId,
      p_brand_name: look.brand_name ?? "",
      p_brand_logo_url: look.brand_logo_url ?? "",
      p_brand_color: look.brand_color,
      p_brand_bg_color: look.brand_bg_color,
      p_brand_bg_image_url: look.brand_bg_image_url ?? "",
      p_cover_image_url: look.cover_image_url ?? "",
      p_white_label: look.white_label,
    });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Saved. Refresh the voting page to see it." });
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const label = "mb-1 block text-xs font-semibold";
  const disabled = !editable || busy;

  return (
    <div className="mb-4 rounded-xl border p-3.5" style={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-left">
        <span>
          <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            🎨 Look &amp; branding
          </span>
          <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
            {isFree ? "Cover photo" : "Cover photo, logo, colors, background and white-label"}
          </span>
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
          {open ? "Close" : "Edit"}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <span className={label} style={{ color: "var(--text-dim)" }}>
              Cover photo
            </span>
            <ImageField value={look.cover_image_url} onChange={(v) => set({ cover_image_url: v })} label="cover photo" wide />
          </div>

          {isFree ? (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Your logo, school or company colors, a background photo and white-label come with any paid event size.
            </p>
          ) : (
            <>
              <div>
                <span className={label} style={{ color: "var(--text-dim)" }}>
                  {isPrivate ? "School / organization name" : "Brand name"}
                </span>
                <input
                  value={look.brand_name ?? ""}
                  onChange={(e) => set({ brand_name: e.target.value })}
                  maxLength={140}
                  className="w-full rounded-[10px] border px-3 py-2 text-sm"
                  style={box}
                />
              </div>
              <div>
                <span className={label} style={{ color: "var(--text-dim)" }}>
                  Logo
                </span>
                <ImageField value={look.brand_logo_url} onChange={(v) => set({ brand_logo_url: v })} label="logo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Accent color", "brand_color", "#1b4fe4", "Buttons, bars, highlights"],
                    ["Page background", "brand_bg_color", "#f4f6fb", "Behind the ballot"],
                  ] as const
                ).map(([text, key, fallback, hint]) => (
                  <div key={key}>
                    <span className={label} style={{ color: "var(--text-dim)" }}>
                      {text}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={look[key] ?? fallback}
                        onChange={(e) => set({ [key]: e.target.value } as Partial<Look>)}
                        className="h-9 w-12 cursor-pointer rounded border"
                        style={{ borderColor: "var(--border)" }}
                        aria-label={text}
                      />
                      {look[key] ? (
                        <button type="button" onClick={() => set({ [key]: null } as Partial<Look>)} className="text-xs underline" style={{ color: "var(--text-faint)" }}>
                          Reset
                        </button>
                      ) : (
                        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {hint}
                    </span>
                  </div>
                ))}
              </div>
              {look.brand_color && contrastRatio(look.brand_color, "#ffffff") < 3 && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>
                  That accent is very light — white button text on it will be hard to read.
                </p>
              )}
              <div>
                <span className={label} style={{ color: "var(--text-dim)" }}>
                  Background photo
                </span>
                <ImageField value={look.brand_bg_image_url} onChange={(v) => set({ brand_bg_image_url: v })} label="background" wide />
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--red)]"
                  checked={look.white_label}
                  onChange={(e) => set({ white_label: e.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-semibold">White-label voting page</span>
                  <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                    Hide the BoutCasts menu and footer so the page is all yours (a small &ldquo;Powered by BoutCasts&rdquo; line stays).
                    {isPrivate ? " Included with every paid private event." : " Needs Large, Pro analytics or Organizer Pro."}
                  </span>
                </span>
              </label>
            </>
          )}

          {editable ? (
            <button type="button" onClick={save} disabled={disabled} className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60">
              {busy ? "Saving…" : "Save look"}
            </button>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              This event is closed, so its look can&apos;t change.
            </p>
          )}
          {msg && (
            <p className="text-xs" style={{ color: msg.ok ? "var(--text-dim)" : "var(--danger)" }}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
