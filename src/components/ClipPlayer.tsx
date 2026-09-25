"use client";

import { useEffect, useState } from "react";

type AdPayload = {
  id: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  clickUrl: string | null;
  headline: string | null;
  sponsorName: string;
};

const SKIP_AFTER_MS = 5000;
const IMAGE_AD_DURATION_MS = 6000;

// Embedded player for self-hosted clips (uploaded or in-app recorded
// submissions) — this is the one place a real pre-roll ad makes sense,
// since it's the only clip playback BoutCasts actually controls end to
// end (external links to YouTube/TikTok/etc. just open on their own site).
export default function ClipPlayer({
  src,
  isAudio,
  label,
}: {
  src: string;
  isAudio: boolean;
  label: string;
}) {
  const [ad, setAd] = useState<AdPayload | null>(null);
  const [adChecked, setAdChecked] = useState(false);
  const [showingAd, setShowingAd] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ads/serve?placement=preroll")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ad) {
          setAd(data.ad);
          setShowingAd(true);
        }
        setAdChecked(true);
      })
      .catch(() => setAdChecked(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showingAd || !ad) return;
    setCanSkip(false);
    const skipTimer = setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    if (ad.mediaType === "image") {
      endTimer = setTimeout(() => setShowingAd(false), IMAGE_AD_DURATION_MS);
    }
    return () => {
      clearTimeout(skipTimer);
      if (endTimer) clearTimeout(endTimer);
    };
  }, [showingAd, ad]);

  async function handleAdClick() {
    if (!ad) return;
    try {
      await fetch(`/api/ads/${ad.id}/click`, { method: "POST" });
    } catch {
      // ignore tracking failures
    }
    if (ad.clickUrl) window.open(ad.clickUrl, "_blank", "noopener,noreferrer");
  }

  if (!adChecked) {
    return (
      <div
        className="flex aspect-video w-full items-center justify-center rounded-xl"
        style={{ background: "var(--surface-2)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          Loading {label}...
        </span>
      </div>
    );
  }

  if (showingAd && ad) {
    return (
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
        >
          <span>Sponsored — {ad.sponsorName}</span>
          {canSkip ? (
            <button
              onClick={() => setShowingAd(false)}
              className="rounded-full border px-2 py-0.5"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Skip ▶
            </button>
          ) : (
            <span>Ad plays before {label}</span>
          )}
        </div>
        <button onClick={handleAdClick} className="block w-full">
          {ad.mediaType === "video" ? (
            <video
              src={ad.mediaUrl}
              autoPlay
              muted
              playsInline
              onEnded={() => setShowingAd(false)}
              className="aspect-video w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.mediaUrl} alt={ad.headline ?? ad.sponsorName} className="aspect-video w-full object-cover" />
          )}
        </button>
      </div>
    );
  }

  if (isAudio) {
    return <audio src={src} controls className="w-full" />;
  }

  // Uploads can be photos too (the picker accepts JPG/PNG/WebP) — a <video>
  // tag would just show a black box for those.
  if (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className="aspect-video w-full rounded-xl object-contain"
        style={{ background: "var(--surface-2)" }}
      />
    );
  }

  return (
    <video
      src={src}
      controls
      playsInline
      className="aspect-video w-full rounded-xl object-cover"
      style={{ background: "var(--surface-2)" }}
    />
  );
}
