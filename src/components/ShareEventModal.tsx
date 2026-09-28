"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Share popup for a Live Vote: QR code (with a full-screen mode for the
// projector / jumbotron), copy link, PNG download for flyers, and the
// phone's native share sheet when available.

export default function ShareEventModal({
  url,
  title,
  onClose,
  heading = "Share your Live Vote",
  callToAction = "Scan to vote",
}: {
  url: string;
  title: string;
  onClose: () => void;
  heading?: string;
  callToAction?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0A0E1A", light: "#FFFFFF" },
    }).then((data) => {
      if (!cancelled) setQr(data);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (fullscreen) setFullscreen(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, onClose]);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: `${callToAction}: ${title}`, url });
    } catch {
      // user cancelled — nothing to do
    }
  }

  const shortUrl = url.replace(/^https?:\/\//, "");
  const fileName = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "live-vote"}-qr.png`;

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 p-6"
        style={{ background: "#0A0E1A", color: "#fff" }}
        role="dialog"
        aria-modal="true"
        aria-label={`QR code for ${title}`}
      >
        <p className="text-center text-sm font-bold uppercase tracking-[0.2em]" style={{ color: "#9FB8FF" }}>
          {callToAction}
        </p>
        <h2
          className="max-w-4xl text-center text-3xl font-bold leading-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`QR code linking to ${shortUrl}`}
            className="rounded-2xl"
            style={{ width: "min(70vmin, 640px)", height: "min(70vmin, 640px)" }}
          />
        )}
        <p className="text-center text-xl font-bold sm:text-2xl">{shortUrl}</p>
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="absolute right-4 top-4 rounded-full border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: "rgba(255,255,255,.3)" }}
        >
          Exit full screen
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center"
      style={{ background: "rgba(10,14,26,.6)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share this Live Vote"
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              {heading}
            </p>
            <p className="font-semibold leading-snug">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-1 text-lg leading-none"
            style={{ color: "var(--text-faint)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mx-auto mb-3 aspect-square w-56 overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--border)" }}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code linking to ${shortUrl}`} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--text-faint)" }}>
              Generating…
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <code className="flex-1 truncate text-sm">{shortUrl}</code>
          <button type="button" onClick={copy} className="text-xs font-bold" style={{ color: "var(--red)" }}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            disabled={!qr}
            className="bc-btn-solid col-span-2 rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            Show full screen (projector)
          </button>
          {qr && (
            <a
              href={qr}
              download={fileName}
              className="rounded-full border px-4 py-2 text-center text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Download QR
            </a>
          )}
          {canShare ? (
            <button
              type="button"
              onClick={nativeShare}
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Share…
            </button>
          ) : (
            <button
              type="button"
              onClick={copy}
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
