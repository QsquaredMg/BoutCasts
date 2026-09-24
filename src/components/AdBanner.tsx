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

// Inline banner ad slot — the lighter-weight sibling of AdInterstitial.
// Same /api/ads/serve endpoint, just a different placement, rendered as a
// normal piece of the page rather than an overlay. Pass `placement` to
// reuse this slot for a different ad_creatives placement value (e.g. the
// admin-gated "live_vote" placement on a Live Vote ballot) — defaults to
// "banner" to preserve every existing call site.
export default function AdBanner({ placement = "banner" }: { placement?: string }) {
  const [ad, setAd] = useState<AdPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ads/serve?placement=${encodeURIComponent(placement)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ad) setAd(data.ad);
      })
      .catch(() => {
        // no ad available — render nothing
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (!ad) return null;

  async function handleClick() {
    try {
      await fetch(`/api/ads/${ad!.id}/click`, { method: "POST" });
    } catch {
      // ignore tracking failures
    }
    if (ad!.clickUrl) {
      window.open(ad!.clickUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button
      onClick={handleClick}
      className="mb-4 flex w-full items-center gap-3 overflow-hidden rounded-xl border p-3 text-left"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {ad.mediaType === "video" ? (
        <video src={ad.mediaUrl} autoPlay muted loop playsInline className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.mediaUrl} alt={ad.headline ?? ad.sponsorName} className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
          Sponsored &middot; {ad.sponsorName}
        </div>
        <div className="truncate text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {ad.headline ?? `Presented by ${ad.sponsorName}`}
        </div>
      </div>
    </button>
  );
}
