"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type AdPayload = {
  id: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  clickUrl: string | null;
  headline: string | null;
  sponsorName: string;
};

const SESSION_KEY = "bc_interstitial_shown_at";
const MIN_GAP_MS = 30 * 60 * 1000; // don't re-fire more than once per 30 min in a session
const SKIP_AFTER_MS = 5000;

// Platform-wide interstitial ad slot — this is what sponsors buying the
// "Platform-Wide Commercial" opportunity are actually paying for. Fires once
// per session (rate-limited client-side) via /api/ads/serve, which also
// records the impression server-side.
export default function AdInterstitial() {
  const pathname = usePathname();
  const [ad, setAd] = useState<AdPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/admin") || pathname === "/welcome") return;
    let cancelled = false;

    try {
      const lastShown = sessionStorage.getItem(SESSION_KEY);
      if (lastShown && Date.now() - Number(lastShown) < MIN_GAP_MS) {
        return;
      }
    } catch {
      // sessionStorage unavailable — fall through and still try to serve
    }

    async function load() {
      try {
        const res = await fetch("/api/ads/serve?placement=interstitial");
        const data = await res.json();
        if (!cancelled && data.ad) {
          setAd(data.ad);
          setVisible(true);
          try {
            sessionStorage.setItem(SESSION_KEY, String(Date.now()));
          } catch {
            // ignore
          }
        }
      } catch {
        // no ad available or network error — fail silently, never block the app
      }
    }

    const timer = setTimeout(load, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    setCanSkip(false);
    const t = setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible || !ad) return null;

  async function handleClick() {
    try {
      await fetch(`/api/ads/${ad!.id}/click`, { method: "POST" });
    } catch {
      // ignore tracking failures — the click-through still happens
    }
    if (ad!.clickUrl) {
      window.open(ad!.clickUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: "rgba(10,11,16,0.88)" }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
        >
          <span>Sponsored — {ad.sponsorName}</span>
          {canSkip ? (
            <button
              onClick={() => setVisible(false)}
              className="rounded-full border px-2 py-0.5"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Skip ✕
            </button>
          ) : (
            <span>Ad</span>
          )}
        </div>

        <button onClick={handleClick} className="block w-full text-left">
          {ad.mediaType === "video" ? (
            <video
              src={ad.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="w-full"
              style={{ maxHeight: 420, objectFit: "cover" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.mediaUrl} alt={ad.headline ?? ad.sponsorName} className="w-full" style={{ maxHeight: 420, objectFit: "cover" }} />
          )}
          {ad.headline && (
            <div className="px-4 py-3 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {ad.headline}
            </div>
          )}
        </button>

        {canSkip && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setVisible(false)}
              className="bc-btn-outline-red w-full rounded-lg py-2 text-sm"
            >
              Continue to BoutCasts
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
