"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, youTubeId, type DebatePost, type YTPlayer } from "@/lib/debates";

// Plays one debate turn. When `onWatched` is given, it measures how much of
// the video was actually played (skipping ahead doesn't count) and reports
// progress so the database can unlock the viewer's reply.
export default function DebateVideo({
  post,
  onWatched,
}: {
  post: DebatePost;
  onWatched?: (seconds: number) => void;
}) {
  const ytId = post.source_type === "link" ? youTubeId(post.source_url) : null;
  if (post.source_type === "missed") {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>
        Turn missed — no video
      </div>
    );
  }
  return ytId ? <YouTubeTurn id={ytId} onWatched={onWatched} /> : <HostedTurn url={post.source_url ?? ""} onWatched={onWatched} />;
}

function HostedTurn({ url, onWatched }: { url: string; onWatched?: (s: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSent = useRef(0);

  function report(force = false) {
    const v = ref.current;
    if (!v || !onWatched) return;
    let total = 0;
    for (let i = 0; i < v.played.length; i++) total += v.played.end(i) - v.played.start(i);
    const secs = Math.floor(total);
    if (force || secs - lastSent.current >= 5) {
      lastSent.current = secs;
      onWatched(secs);
    }
  }

  return (
    <video
      ref={ref}
      src={url}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-xl bg-black"
      onTimeUpdate={() => report(false)}
      onPause={() => report(true)}
      onEnded={() => report(true)}
    />
  );
}

function YouTubeTurn({ id, onWatched }: { id: string; onWatched?: (s: number) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let watched = 0;
    let last = -1;
    let lastSent = 0;
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !holder.current) return;
        const el = document.createElement("div");
        holder.current.innerHTML = "";
        holder.current.appendChild(el);
        player = new YT.Player(el, {
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, end: 180 },
          events: {
            onStateChange: (e) => {
              if (!onWatched) return;
              if (e.data === YT.PlayerState.PLAYING && !timer) {
                last = player!.getCurrentTime();
                timer = setInterval(() => {
                  const t = player!.getCurrentTime();
                  const delta = t - last;
                  // Only normal playback counts; jumps (seeking) don't.
                  if (delta > 0 && delta <= 2.5) watched += delta;
                  last = t;
                  if (watched - lastSent >= 5) {
                    lastSent = watched;
                    onWatched(Math.floor(watched));
                  }
                }, 1000);
              } else if (e.data !== YT.PlayerState.PLAYING && timer) {
                clearInterval(timer);
                timer = null;
                onWatched(Math.floor(watched));
              }
            },
            onError: () => setFailed(true),
          },
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      player?.destroy();
    };
  }, [id, onWatched]);

  if (failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl p-4 text-center text-sm" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>
        This YouTube video can&apos;t be played here (it may be private or have embedding turned off).
      </div>
    );
  }
  return <div ref={holder} className="aspect-video w-full overflow-hidden rounded-xl bg-black [&>iframe]:h-full [&>iframe]:w-full" />;
}
