"use client";

import Script from "next/script";
import { getEmbedInfo } from "@/lib/clipSource";
import { safeHttpUrl } from "@/lib/safeUrl";

// Plays a "link"-type submission (YouTube, TikTok, Instagram, Vimeo,
// SoundCloud, Spotify) inline, right on the bout page, instead of sending
// the voter to the original site to watch it. Falls back to nothing (the
// caller keeps showing the existing "watch on <platform>" badge/link) for a
// link we don't know how to embed.
export default function EmbeddedClipPlayer({
  sourceUrl,
  label,
  privacy = false,
}: {
  sourceUrl: string;
  label: string;
  /** Student-facing pages: YouTube without tracking cookies and without "related videos" from other channels. */
  privacy?: boolean;
}) {
  const info = getEmbedInfo(sourceUrl);
  if (!info) return null;

  if (info.kind === "iframe") {
    return (
      <div className="overflow-hidden rounded-xl" style={{ background: "#000" }}>
        <iframe
          src={privacy ? info.src.replace("://www.youtube.com/embed/", "://www.youtube-nocookie.com/embed/") + (info.src.includes("youtube.com") ? "?rel=0" : "") : info.src}
          title={label}
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
          allowFullScreen
          loading="lazy"
          className="w-full border-0"
          style={info.layout === "video" ? { aspectRatio: "16 / 9" } : { height: info.height }}
        />
      </div>
    );
  }

  if (info.kind === "tiktok") {
    return (
      <>
        <blockquote
          className="tiktok-embed"
          cite={info.url}
          style={{ maxWidth: "100%", minWidth: 240, margin: 0 }}
        >
          <a href={safeHttpUrl(info.url) ?? undefined} target="_blank" rel="noreferrer">
            {label}
          </a>
        </blockquote>
        <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />
      </>
    );
  }

  // Instagram
  return (
    <>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={info.url}
        data-instgrm-version="14"
        style={{ maxWidth: "100%", minWidth: 240, margin: 0 }}
      >
        <a href={safeHttpUrl(info.url) ?? undefined} target="_blank" rel="noreferrer">
          {label}
        </a>
      </blockquote>
      <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />
    </>
  );
}
