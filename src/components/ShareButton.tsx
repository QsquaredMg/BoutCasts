"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  storyImageUrl,
  url,
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
  /** A full-height 9:16 graphic for an Instagram Story. When set, the Instagram button saves it and copies just the link, ready for a Story link sticker. */
  storyImageUrl?: string;
  /** Link to share (a path like /predictions/123 works). Defaults to the page being viewed. */
  url?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const [canNative, setCanNative] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const linkToShare = () => new URL(url ?? window.location.href, window.location.href).href;
  const shareText = text ?? `${title} — cast your vote, or start your own Bout, on BoutCasts!`;

  useEffect(() => {
    // navigator isn't available during server render
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
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
    const url = linkToShare();
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
    const href = intentUrl(n, linkToShare(), shareText);
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
    if (!(await copyText(linkToShare()))) {
      setNote("Couldn't copy. Press and hold the page address to copy it.");
      return;
    }
    setCopied(true);
    close();
    setTimeout(() => setCopied(false), 2000);
  }

  // Instagram and TikTok have no web share link, so save the graphic and
  // copy the link (or caption) — the person pastes it into the app.
  // With a Story graphic, only the bare link is copied: that is what Instagram's
  // link sticker needs, and the graphic already says what to do.
  async function forInstagramTikTok() {
    logShare(track, "share");
    const url = linkToShare();
    const forStory = !!storyImageUrl;
    const copiedText = await copyText(forStory ? url : `${shareText} ${url}`);
    const graphic = storyImageUrl ?? imageUrl;
    if (graphic) {
      try {
        const res = await fetch(graphic);
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
            forStory
              ? copiedText
                ? "Image saved and link copied. In Instagram, add the image to your Story, tap the sticker icon, choose Link, and paste. Friends vote without leaving Instagram."
                : "Image saved. In Instagram, add it to your Story, tap the sticker icon, choose Link, and paste the page address."
              : copiedText
                ? "Image saved and caption copied. Open Instagram or TikTok, add the image to a post or story, and paste the caption."
                : "Image saved. Open Instagram or TikTok and add the image to a post or story.",
          );
          return;
        }
      } catch {
        // fall through to the text-only message
      }
    }
    setNote(
      copiedText
        ? "Link copied. Open Instagram or TikTok and paste it into a post, a Story link sticker, or your bio link."
        : "Couldn't copy. Press and hold the page address to copy it, then paste it in the app.",
    );
  }

  // Colors are explicit on purpose: pages with a dark header (like Bout Predictions) restyle every
// button inside it, which used to leave this sheet's labels pale on white. The sheet is also
// rendered on document.body so no page styling can reach it.
const INK = "#0a0e1a";
const tile = "flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-3 text-sm font-bold active:scale-[0.98]";
const tileStyle = { borderColor: "#d5ddf0", background: "#f4f6fb", color: INK } as const;

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
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          style={{ background: "rgba(5,8,24,.72)" }}
          onClick={close}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Share"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
            style={{ background: "#ffffff", color: INK, paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black" style={{ color: INK }}>Share</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close share menu"
                className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold"
                style={{ background: "#e9edf7", color: INK }}
              >
                ✕
              </button>
            </div>
            {canNative && (
              <button
                type="button"
                onClick={nativeShare}
                className="mb-4 flex min-h-[56px] w-full items-center justify-center rounded-full px-4 text-base font-extrabold"
                style={{ background: "#1b4fe4", color: "#ffffff" }}
              >
                📲 Share with an app on this device
              </button>
            )}
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {NETWORKS.map((n) => (
                <button key={n.id} type="button" onClick={() => toNetwork(n.id)} className={tile} style={tileStyle}>
                  <span aria-hidden className="text-3xl leading-none">{n.icon}</span>
                  {n.label}
                </button>
              ))}
              <button type="button" onClick={forInstagramTikTok} className={`${tile} col-span-2`} style={tileStyle}>
                <span aria-hidden className="text-3xl leading-none">📸</span>
                {storyImageUrl ? "Instagram Story / TikTok" : "Instagram / TikTok"}
              </button>
              <button type="button" onClick={copyLink} className={`${tile} col-span-3 sm:col-span-4`} style={{ ...tileStyle, background: "#0a0f2c", borderColor: "#0a0f2c", color: "#ffffff", minHeight: 64 }}>
                <span aria-hidden className="text-2xl leading-none">🔗</span>
                Copy link
              </button>
            </div>
            <p className="mt-3 min-h-[1.25rem] text-sm font-semibold" role="status" style={{ color: "#3a4256" }}>
              {note}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
