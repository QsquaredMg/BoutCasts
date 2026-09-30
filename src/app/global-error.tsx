"use client";

import { useEffect } from "react";

// Shown only if the whole site layout fails. Renders its own page, so styles are inline.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f6fb", color: "#0a0e1a" }}>
        <title>Something went wrong | BoutCasts</title>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: 0 }}>🥊</p>
          <h1 style={{ fontSize: 24, margin: "8px 0" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 24 }}>We&apos;ve been notified. Please try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#1b4fe4", color: "#fff", border: 0, borderRadius: 999, padding: "10px 20px", fontWeight: 700, fontSize: 14 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
