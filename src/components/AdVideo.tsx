"use client";

import { useEffect, useRef, useState } from "react";

// Video ad player with sound. Browsers only allow a video to start playing
// on its own if it's muted, unless the person has already interacted with
// the site. So we try to play with sound first; if the browser refuses, we
// play muted and show a "Tap for sound" button. One tap turns sound on.
export default function AdVideo({
  src,
  onOpen,
  className,
  style,
}: {
  src: string;
  onOpen?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    v.muted = false;
    v.volume = 1;
    v.play()
      .then(() => {
        if (!cancelled) setMuted(false);
      })
      .catch(() => {
        // Sound not allowed yet — fall back to a silent autoplay.
        if (cancelled) return;
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {
          // Autoplay fully blocked (e.g. data saver); the poster frame shows.
        });
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  function toggleSound(e: React.MouseEvent) {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    const nextMuted = !muted;
    v.muted = nextMuted;
    if (!nextMuted) {
      v.volume = 1;
      v.play().catch(() => {});
    }
    setMuted(nextMuted);
  }

  return (
    <div className="relative">
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="auto"
        onClick={onOpen}
        className={className}
        style={{ ...style, cursor: onOpen ? "pointer" : undefined }}
      />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={muted ? "Turn sound on" : "Mute"}
        className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white"
        style={{ background: "rgba(10,14,26,0.78)", backdropFilter: "blur(4px)" }}
      >
        <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
        {muted ? "Tap for sound" : "Sound on"}
      </button>
    </div>
  );
}
