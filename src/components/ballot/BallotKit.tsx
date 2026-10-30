"use client";

import { useState } from "react";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { contrastRatio, isHexColor, roomThemeVars } from "@/lib/liveVoteEvents/roomTheme";

// The school ballot look (header bar in the school's color, paper page, white candidate cards, progress bar),
// shared by the vote-by-link page and the kiosk. Colors come from the election's setup: the accent color
// colors the header, buttons and highlights; the background color is the page. Text flips between white and
// black automatically so it is always readable.

export type BallotBrand = {
  logo?: string | null;
  banner?: string | null;
  color?: string | null;
  bg?: string | null;
  bgImage?: string | null;
};

export type BallotCandidate = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  video_url?: string | null;
  clip_url?: string | null;
};

export type BallotTheme = {
  accent: string;
  onAccent: string;
  paper: string;
  ink: string;
  danger: string;
  /** Border/highlight color that stays visible even when the accent is close to the paper color. */
  edge: string;
  page: React.CSSProperties;
};

const DARK = "#111111";
const LIGHT = "#ffffff";
const best = (bg: string) => (contrastRatio(bg, LIGHT) >= contrastRatio(bg, DARK) ? LIGHT : DARK);

export function ballotTheme(b?: BallotBrand | null): BallotTheme {
  const accent = isHexColor(b?.color) ? (b!.color as string) : "#1b4fe4";
  const paper = isHexColor(b?.bg) ? (b!.bg as string) : "#f6f4ee";
  const ink = best(paper);
  const vars = roomThemeVars(null, paper, b?.bgImage ?? null);
  const page: React.CSSProperties = {
    backgroundColor: paper,
    backgroundImage: vars.backgroundImage,
    backgroundSize: vars.backgroundSize,
    backgroundPosition: vars.backgroundPosition,
    color: ink,
  };
  return {
    accent,
    onAccent: best(accent),
    paper,
    ink,
    danger: ink === LIGHT ? "#ff8a80" : "#c62828",
    edge: contrastRatio(accent, paper) >= 1.8 ? accent : ink,
    page,
  };
}

function initials(name: string) {
  const words = name.replace(/^(Mr|Ms|Mrs|Dr|Coach)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const a = words[0][0] ?? "";
  const b = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (a + b).toUpperCase();
}

/** Coloured header bar: logo circle, school name, what is being voted on, and a LIVE dot. */
export function BallotHeader({ theme, brand, school, kicker, live = true }: { theme: BallotTheme; brand?: BallotBrand | null; school: string | null; kicker: string; live?: boolean }) {
  return (
    <div>
      {brand?.banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.banner} alt="" className="h-28 w-full object-cover sm:h-36" />
      )}
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: theme.accent, color: theme.onAccent }}>
        {brand?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full bg-white object-cover" />
        ) : (
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold" style={{ background: theme.onAccent, color: theme.accent }}>
            {initials(school ?? "School")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-extrabold leading-tight">{school ?? "School election"}</div>
          <div className="truncate text-[12px] opacity-80">{kicker}</div>
        </div>
        {live && (
          <span className="flex items-center gap-1.5 text-[12px] font-extrabold">
            <span className="lp-live-dot" aria-hidden /> LIVE
          </span>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({ theme, step, total, label }: { theme: BallotTheme; step: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((step / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[13px] font-bold" style={{ opacity: 0.75 }}>
        <span>Office {Math.min(step, total)} of {total}</span>
        {label && <span>{label}</span>}
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step} className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(127,127,127,0.25)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.edge, transition: "width .3s ease" }} />
      </div>
    </div>
  );
}

/** Plays a candidate's video inside the page at its real shape, fitted to the frame. */
export function CandidateVideo({ c, theme }: { c: BallotCandidate; theme: BallotTheme }) {
  if (c.video_url) {
    return (
      <video
        src={c.video_url}
        controls
        playsInline
        preload="metadata"
        aria-label={`${c.name} speech`}
        className="mx-auto block w-full rounded-xl"
        style={{ background: "#000", maxHeight: "65vh", objectFit: "contain" }}
      />
    );
  }
  if (c.clip_url) {
    // Google Drive's player puts an "open in Drive" button in its top-right corner. A clear cover over that
    // corner takes the tap instead, so nobody gets sent out of the ballot.
    const drive = /(^|\.)drive\.google\.com\//i.test(c.clip_url.replace(/^https?:\/\//i, ""));
    return (
      <div className="relative overflow-hidden rounded-xl" style={{ background: "#000", border: `1px solid ${theme.edge}33` }}>
        <EmbeddedClipPlayer sourceUrl={c.clip_url} label={`${c.name} video`} privacy />
        {drive && <div aria-hidden className="absolute right-0 top-0 h-16 w-20" style={{ background: "transparent" }} onClick={(e) => e.stopPropagation()} />}
      </div>
    );
  }
  return null;
}

/** One candidate: tap the card to pick, tap "Watch speech" to open the video under it. */
export function CandidateCard({
  c, theme, selected, onSelect, disabled, large = false, videoOk = true, trailing,
}: {
  c: BallotCandidate; theme: BallotTheme; selected: boolean; onSelect: () => void; disabled?: boolean; large?: boolean; videoOk?: boolean; trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasVideo = Boolean(c.video_url || (c.clip_url && videoOk));
  const size = large ? 72 : 52;
  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: "#fff", color: DARK, border: `2px solid ${selected ? theme.edge : "rgba(0,0,0,0.12)"}` }}>
      <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onSelect} className="relative flex w-full items-center gap-3 px-3.5 py-3 text-left" style={{ background: selected ? `${theme.accent}14` : "transparent", cursor: disabled ? "default" : "pointer" }}>
        {c.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image_url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, border: `2px solid ${theme.accent}` }} />
        ) : (
          <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full font-extrabold" style={{ width: size, height: size, background: theme.accent, color: theme.onAccent, fontSize: large ? 24 : 17 }}>{initials(c.name)}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block font-extrabold leading-tight ${large ? "text-2xl" : "text-[16px]"}`}>{c.name}</span>
          {c.description && <span className={`mt-0.5 block leading-snug ${large ? "text-base" : "text-[13px]"}`} style={{ opacity: 0.7 }}>{c.description}</span>}
        </span>
        {trailing ?? (
          <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ border: `2px solid ${selected ? theme.accent : "rgba(0,0,0,0.25)"}`, background: selected ? theme.accent : "transparent" }}>
            {selected && <span className="h-2 w-2 rounded-full" style={{ background: theme.onAccent }} />}
          </span>
        )}
      </button>
      {hasVideo && (
        <div className="px-3.5 pb-3">
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`rounded-full px-4 py-1.5 font-bold ${large ? "text-base" : "text-[13px]"}`} style={{ background: theme.accent, color: theme.onAccent }}>
            {open ? "✕ Hide video" : "▶ Watch speech"}
          </button>
          {open && <div className="mt-2.5"><CandidateVideo c={c} theme={theme} /></div>}
        </div>
      )}
    </div>
  );
}
