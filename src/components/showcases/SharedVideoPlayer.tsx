"use client";

import { useEffect, useRef, useState } from "react";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { loadYouTubeApi, youTubeId, type YTPlayer } from "@/lib/debates";

// One video shared by every choice. Pass `seek` ({ t, n }) to jump to a
// time: `n` just needs to change each request so repeat taps still work.
export default function SharedVideoPlayer({
  sourceUrl,
  label,
  seek,
}: {
  sourceUrl: string;
  label: string;
  seek?: { t: number; n: number } | null;
}) {
  const ytId = youTubeId(sourceUrl);
  if (ytId) return <YouTubeShared id={ytId} seek={seek} />;
  const isHosted = /supabase\.co\/storage\//.test(sourceUrl) || /\.(mp4|mov|webm|m4v|mp3|m4a|wav)(\?|$)/i.test(sourceUrl);
  if (isHosted) return <HostedShared url={sourceUrl} seek={seek} />;
  return <EmbeddedClipPlayer sourceUrl={sourceUrl} label={label} />;
}

function HostedShared({ url, seek }: { url: string; seek?: { t: number; n: number } | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !seek) return;
    v.currentTime = seek.t;
    v.play().catch(() => {});
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [seek]);
  return <video ref={ref} src={url} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black" />;
}

function YouTubeShared({ id, seek }: { id: string; seek?: { t: number; n: number } | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const pending = useRef<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !holder.current) return;
        const el = document.createElement("div");
        holder.current.innerHTML = "";
        holder.current.appendChild(el);
        player.current = new YT.Player(el, {
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: (e) => {
              if (pending.current != null) {
                e.target.seekTo(pending.current, true);
                e.target.playVideo();
                pending.current = null;
              }
            },
            onError: () => setFailed(true),
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (!seek) return;
    holder.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const p = player.current;
    if (p && typeof p.seekTo === "function") {
      p.seekTo(seek.t, true);
      p.playVideo();
    } else {
      pending.current = seek.t;
    }
  }, [seek]);

  if (failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl p-4 text-center text-sm" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>
        This video can&apos;t be played here (it may be private or have embedding turned off).
      </div>
    );
  }
  return <div ref={holder} className="aspect-video w-full overflow-hidden rounded-xl bg-black [&>iframe]:h-full [&>iframe]:w-full" />;
}
