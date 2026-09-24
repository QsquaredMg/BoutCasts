"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SHOW_MS = 1600;
const FADE_MS = 350;
const WELCOMED_KEY = "bc_welcomed";

// The splash markup is always server-rendered but hidden by CSS unless
// SplashGate's boot script set <html data-splash="on">. This component plays
// it, fades it out, then sends first-time signed-out users to /welcome.
export default function SplashScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "leaving" | "done">("idle");

  useEffect(() => {
    const root = document.documentElement;
    // Not launching as the installed app: the splash stays hidden by CSS.
    if (root.getAttribute("data-splash") !== "on") return;
    const forced = new URLSearchParams(window.location.search).get("splash") === "1";
    try {
      sessionStorage.setItem("bc_splash_seen", "1");
    } catch {}

    let cancelled = false;

    // Decide where to go while the splash is still up.
    const destination: Promise<string | null> = (async () => {
      if (forced) return "/welcome";
      if (pathname !== "/") return null;
      let welcomed = false;
      try {
        welcomed = localStorage.getItem(WELCOMED_KEY) === "1";
      } catch {}
      if (welcomed) return null;
      const { data } = await createClient().auth.getUser();
      return data.user ? null : "/welcome";
    })().catch(() => null);

    const showTimer = window.setTimeout(async () => {
      const dest = await destination;
      if (cancelled) return;
      if (dest) {
        try {
          localStorage.setItem(WELCOMED_KEY, "1");
        } catch {}
        router.replace(dest);
      }
      setPhase("leaving");
      window.setTimeout(() => {
        if (cancelled) return;
        root.removeAttribute("data-splash");
        setPhase("done");
      }, FADE_MS);
    }, SHOW_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
    // Run once per full page load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "done") return null;

  return (
    <div className="splash-root" data-leaving={phase === "leaving"} role="status" aria-label="Loading BoutCasts">
      <div aria-hidden className="splash-slash" />
      <div aria-hidden className="splash-stripe" />

      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-9 px-7">
        <div
          className="splash-rise w-full max-w-[334px] rounded-[22px] px-[18px] py-[22px]"
          style={{ background: "rgba(10,14,26,0.84)", boxShadow: "0 30px 60px rgba(0,0,0,0.45)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/boutcasts-logo-reverse.png" alt="BoutCasts — Voting and Competition Platform" className="block h-auto w-full" />
        </div>

        <div className="flex w-[280px] flex-col gap-2.5" aria-hidden>
          <div className="flex items-center gap-2.5">
            <div className="flex h-2.5 flex-1 justify-end overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
              <div className="splash-bar-a h-full rounded-full" style={{ width: "56%", background: "#1b4fe4" }} />
            </div>
            <div className="text-[13px] font-black tracking-[0.12em] text-white" style={{ fontFamily: "var(--font-hero)", fontStretch: "125%" }}>
              VS
            </div>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
              <div className="splash-bar-b h-full rounded-full bg-white" style={{ width: "36%" }} />
            </div>
          </div>
          <div className="text-center text-[13px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#a8b0c4" }}>
            Counting the crowd…
          </div>
        </div>
      </div>

      <div className="relative flex w-full flex-col items-center gap-3.5 px-7 pb-[max(52px,env(safe-area-inset-bottom))] text-white">
        <div className="lp-display text-center text-[30px]" style={{ lineHeight: 1 }}>
          Let the crowd <span style={{ color: "#6e97ff" }}>decide.</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-extrabold tracking-[0.12em]">
          <span className="lp-live-dot" aria-hidden />
          LIVE VOTING · BATTLES · ELECTIONS
        </div>
      </div>
    </div>
  );
}
