"use client";

import { useEffect, useRef, useState } from "react";
import { logShare, type ShareTarget } from "@/lib/shareLog";

type Network =
  | "x"
  | "facebook"
  | "whatsapp"
  | "threads"
  | "reddit"
  | "linkedin"
  | "telegram"
  | "bluesky"
  | "email"
  | "sms";

const NETWORKS: { id: Network; icon: string; label: string }[] = [
  { id: "x", icon: "𝕏", label: "X" },
  { id: "facebook", icon: "📘", label: "Facebook" },
  { id: "whatsapp", icon: "💬", label: "WhatsApp" },
  { id: "threads", icon: "🧵", label: "Threads" },
  { id: "reddit", icon: "👽", label: "Reddit" },
  { id: "linkedin", icon: "💼", label: "LinkedIn" },
  { id: "telegram", icon: "✈️", label: "Telegram" },
  { id: "bluesky", icon: "🦋", label: "Bluesky" },
  { id: "email", icon: "✉️", label: "Email" },
  { id: "sms", icon: "📱", label: "Text" },
];

function intentUrl(n: Network, url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const both = encodeURIComponent(`${text} ${url}`);
  switch (n) {
    case "x":
      return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`;
    case "whatsapp":
      return `https://wa.me/?text=${both}`;
    case "threads":
      return `https://www.threads.net/intent/post?text=${both}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${both}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent("Check this out on BoutCasts")}&body=${both}`;
    case "sms":
      return `sms:?&body=${both}`;
  }
}

// Branded share control. The link itself already renders as a BoutCasts-
// branded card wherever it's pasted (per-page opengraph-image + metadata),
// so this component's job is to get the link out with a CTA-carrying caption
// attached on whichever network the person actually uses. Clicking opens a
// sheet with one-tap buttons for the major networks, the phone's own share
// sheet (which lists every installed app), "save image" for Instagram and
// TikTok (they have no web share link), and copy-link.
export default function ShareButton({
  title,
  text,
  label = "🔗 Share",
  big = false,
  track,
  imageUrl,
}: {
  title: string;
  text?: string;
  /** Button text (defaults to "🔗 Share"). */
  label?: string;
  /** Full-width solid button instead of the small pill. */
  big?: boolean;
  /** When set, each share is counted for sponsor reports. */
  track?: ShareTarget;
  /** A graphic to attach on devices that can share files, and to save for Instagram/TikTok. */
  imageUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const [canNative, setCanNative] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const shareText = text ?? `${title} — cast your vote, or start your own Bout, on BoutCasts!`;

  useEffect(() => {
    // navigator isn't available during server render
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        openerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setNote("");
    openerRef.current?.focus();
  }

  function openSheet() {
    setNote("");
    setOpen(true);
  }

  async function nativeShare() {
    logShare(track, "share");
    const url = window.location.href;
    if (imageUrl && navigator.canShare) {
      try {
        const res = await fetch(imageUrl);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], "boutcasts-vs.png", { type: blob.type || "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "BoutCasts", text: `${shareText} ${url}` });
            close();
            return;
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // fall through to the normal link share
      }
    }
    try {
      await navigator.share({ title: "BoutCasts", text: shareText, url });
      close();
    } catch {
      // cancelled — leave the sheet open so they can pick another way
    }
  }

  function toNetwork(n: Network) {
    logShare(track, "share");
    const href = intentUrl(n, window.location.href, shareText);
    if (n === "email" || n === "sms") {
      // open mail/messages through a temporary link rather than navigating the page
      const a = document.createElement("a");
      a.href = href;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(href, "_blank", "noopener,noreferrer,width=600,height=640");
    }
    close();
  }

  async function copyText(t: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      return false;
    }
  }

  async function copyLink() {
    if (!(await copyText(window.location.href))) {
      setNote("Couldn't copy. Press and hold the page address to copy it.");
      return;
    }
    setCopied(true);
    close();
    setTimeout(() => setCopied(false), 2000);
  }

  // Instagram and TikTok have no web share link, so save the graphic and
  // copy the caption — the person pastes both into the app.
  async function forInstagramTikTok() {
    logShare(track, "share");
    const url = window.location.href;
    const copiedCaption = await copyText(`${shareText} ${url}`);
    if (imageUrl) {
      try {
        const res = await fetch(imageUrl);
        if (res.ok) {
          const blob = await res.blob();
          const href = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = href;
          a.download = "boutcasts-share.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(href), 4000);
          setNote(
            copiedCaption
              ? "Image saved and caption copied. Open Instagram or TikTok, add the image to a post or story, and paste the caption."
              : "Image saved. Open Instagram or TikTok and add it to a post or story.",
          );
          return;
        }
      } catch {
        // fall through to the caption-only message
      }
    }
    setNote(
      copiedCaption
        ? "Caption and link copied. Open Instagram or TikTok and paste it into a post or your bio link."
        : "Couldn't copy. Press and hold the page address to copy it, then paste it in the app.",
    );
  }

  const tile = "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs font-semibold";

  return (
    <div className="relative">
      <button
        ref={openerRef}
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        className={
          big
            ? "bc-btn-solid flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-sm font-bold"
            : "flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold"
        }
        style={big ? undefined : { borderColor: "var(--border)", color: "var(--text-dim)" }}
      >
        {copied ? "Link copied!" : label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={close}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Share"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold">Share</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close share menu"
                className="min-h-[44px] min-w-[44px] rounded-full text-lg"
                style={{ color: "var(--text-dim)" }}
              >
                ✕
              </button>
            </div>
            {canNative && (
              <button
                type="button"
                onClick={nativeShare}
                className="bc-btn-solid mb-3 flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-sm font-bold"
              >
                📲 Share with an app on this device
              </button>
            )}
            <div className="grid grid-cols-4 gap-2">
              {NETWORKS.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => toNetwork(n.id)}
                  className={tile}
                  style={{ borderColor: "var(--border)" }}
                >
                  <span aria-hidden className="text-xl">{n.icon}</span>
                  {n.label}
                </button>
              ))}
              <button
                type="button"
                onClick={forInstagramTikTok}
                className={`${tile} col-span-2`}
                style={{ borderColor: "var(--border)" }}
              >
                <span aria-hidden className="text-xl">📸</span>
                Instagram / TikTok
              </button>
              <button
                type="button"
                onClick={copyLink}
                className={`${tile} col-span-2`}
                style={{ borderColor: "var(--border)" }}
              >
                <span aria-hidden className="text-xl">🔗</span>
                Copy link
              </button>
            </div>
            <p className="mt-3 min-h-[1.25rem] text-xs" role="status" style={{ color: "var(--text-dim)" }}>
              {note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
