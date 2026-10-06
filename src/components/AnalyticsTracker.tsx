"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Sends one anonymous page view per navigation to /api/track. The session id
// is random, lives only for this browser tab session, and is mirrored into a
// session cookie (bc_sid) so server routes can tie ad views to the same visit.
// Admin pages and advertiser report links are never counted.
const SKIP = [/^\/admin(\/|$)/, /^\/report(\/|$)/, /^\/api(\/|$)/];

function getSid(): string {
  let sid = "";
  try {
    sid = sessionStorage.getItem("bc_sid") ?? "";
  } catch {
    // storage blocked - fall through
  }
  if (!sid) {
    const m = document.cookie.match(/(?:^|;\s*)bc_sid=([A-Za-z0-9-]{8,64})/);
    sid = m ? m[1] : crypto.randomUUID();
  }
  try {
    sessionStorage.setItem("bc_sid", sid);
  } catch {
    // ignore
  }
  document.cookie = `bc_sid=${sid}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  return sid;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    if (SKIP.some((re) => re.test(pathname))) return;

    const sid = getSid();
    let first = true;
    try {
      first = sessionStorage.getItem("bc_seen") !== "1";
      sessionStorage.setItem("bc_seen", "1");
    } catch {
      // ignore
    }

    let ref: string | null = null;
    let utm: { source: string | null; medium: string | null; campaign: string | null } = { source: null, medium: null, campaign: null };
    if (first) {
      try {
        if (document.referrer) {
          const host = new URL(document.referrer).hostname;
          if (host && host !== location.hostname && !host.endsWith("boutcasts.com")) ref = host;
        }
      } catch {
        // ignore
      }
      const q = new URLSearchParams(location.search);
      utm = { source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign") };
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        sid, path: pathname, ref,
        utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign,
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
