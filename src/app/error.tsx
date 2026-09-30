"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <p className="mb-2 text-4xl">🥊</p>
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Something went wrong
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        We&apos;ve been notified. Try again, or head back to the matchups.
      </p>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={() => retry()} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold">
          Try again
        </button>
        <Link href="/matchups" className="rounded-full border px-5 py-2.5 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
          Matchups
        </Link>
      </div>
    </div>
  );
}
