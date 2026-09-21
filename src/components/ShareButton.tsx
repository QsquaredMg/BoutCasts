"use client";

import { useState } from "react";

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `BoutCasts: ${title}`, url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold"
      style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
    >
      {copied ? "Link copied!" : "🔗 Share"}
    </button>
  );
}
