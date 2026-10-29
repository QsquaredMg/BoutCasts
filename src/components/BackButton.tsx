"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// "Back" under the top bar on every page except the home page. It returns to the page the person
// just came from. If there is no earlier BoutCasts page in this visit (a shared link, a bookmark, the
// installed app opening straight to this page, or they have already backed up to where they started)
// it reads "Home" and goes to the home page, so Back never walks out of the site.
//
// depth = how many BoutCasts pages sit behind the current one: +1 for each forward navigation, -1 for
// each browser back (popstate). It lives in sessionStorage so it survives a reload.
const KEY = "bc_nav_depth";

function readDepth(): number {
  try {
    return Math.max(0, Number(sessionStorage.getItem(KEY)) || 0);
  } catch {
    return 0;
  }
}

function writeDepth(n: number) {
  try {
    sessionStorage.setItem(KEY, String(Math.max(0, n)));
  } catch {
    // storage blocked: Back falls back to home
  }
}

export default function BackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const last = useRef(pathname);
  const popped = useRef(false);
  const [hasPrev, setHasPrev] = useState(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (pathname !== last.current) {
      last.current = pathname;
      writeDepth(readDepth() + (popped.current ? -1 : 1));
      popped.current = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasPrev(readDepth() > 0);
  }, [pathname]);

  if (pathname === "/") return null;

  return (
    <div data-site-chrome="" className="mx-auto w-full max-w-[1440px] px-4 pt-3 sm:px-5">
      <button
        type="button"
        onClick={() => (hasPrev ? router.back() : router.push("/"))}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold"
        style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
        aria-label={hasPrev ? "Go back to the previous page" : "Go to the home page"}
      >
        <span aria-hidden="true">←</span> {hasPrev ? "Back" : "Home"}
      </button>
    </div>
  );
}
