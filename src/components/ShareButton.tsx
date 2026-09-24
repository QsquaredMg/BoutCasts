"use client";

import { useEffect, useRef, useState } from "react";

// Branded share control. The link itself already renders as a BoutCasts-
// branded card wherever it's pasted (per-page opengraph-image + metadata),
// so this component's job is just to get the link out with a CTA-carrying
// caption attached — "cast your vote, or start your own Bout" — on
// whichever channel the person actually uses. Mobile gets the native share
// sheet (navigator.share carries the caption + link together); desktop
// gets a small menu with direct X/Facebook share links plus copy-link,
// since desktop browsers largely don't implement navigator.share.
export default function ShareButton({ title, text }: { title: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const shareText = text ?? `${title} — cast your vote, or start your own Bout, on BoutCasts!`;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  async function handleShareClick() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "BoutCasts", text: shareText, url });
        return;
      } catch {
        // user cancelled, or the platform's share sheet failed — fall
        // through to our own menu rather than leaving the click dead
      }
    }
    setOpen((o) => !o);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // clipboard unavailable — the menu stays open so they can try again
      return;
    }
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  function openIntent(platform: "x" | "facebook") {
    const url = window.location.href;
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(shareText);
    const intentUrl =
      platform === "x"
        ? `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
        : `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer,width=600,height=520");
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={handleShareClick}
        className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold"
        style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
      >
        {copied ? "Link copied!" : "🔗 Share"}
      </button>
      {open && (
        <div
          className="absolute right-0 z-10 mt-1.5 flex flex-col gap-0.5 rounded-lg border p-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--border)", background: "var(--surface)", minWidth: 168 }}
        >
          <button
            type="button"
            onClick={() => openIntent("x")}
            className="rounded px-2 py-1.5 text-left"
            style={{ color: "var(--text)" }}
          >
            𝕏 Share to X
          </button>
          <button
            type="button"
            onClick={() => openIntent("facebook")}
            className="rounded px-2 py-1.5 text-left"
            style={{ color: "var(--text)" }}
          >
            📘 Share to Facebook
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="rounded px-2 py-1.5 text-left"
            style={{ color: "var(--text)" }}
          >
            🔗 Copy link
          </button>
        </div>
      )}
    </div>
  );
}
