"use client";

import { useEffect, useState } from "react";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";

type AdPayload = {
  id: string;
  mediaType: "image" | "video" | "embed";
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
//
// `near` is for pages that know where they are (a venue or school): it is used for local
// sponsor targeting instead of the visitor's IP location.
export type AdNear = { lat?: number; lng?: number; region?: string };

export default function AdBanner({ placement = "banner", near }: { placement?: string; near?: AdNear }) {
  const [ad, setAd] = useState<AdPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ placement });
    if (near?.lat != null && near?.lng != null) {
      q.set("lat", String(near.lat));
      q.set("lng", String(near.lng));
    }
    if (near?.region) q.set("region", near.region);
    fetch(`/api/ads/serve?${q.toString()}`)
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
  }, [placement, near?.lat, near?.lng, near?.region]);

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

  if (ad.mediaType === "embed") {
    return (
      <div className="mb-4 overflow-hidden rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              Sponsored &middot; {ad.sponsorName}
            </div>
            <div className="truncate text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {ad.headline ?? `Presented by ${ad.sponsorName}`}
            </div>
          </div>
          {ad.clickUrl && (
            <button onClick={handleClick} className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--border)" }}>
              Learn more
            </button>
          )}
        </div>
        <EmbeddedClipPlayer sourceUrl={ad.mediaUrl} label={ad.headline ?? ad.sponsorName} />
      </div>
    );
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
