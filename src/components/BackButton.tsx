"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// "Back" under the top bar on every page except the home page. It returns to the page the person
// just came from. If this visit started on the current page (a shared link, a bookmark, the installed
// app opening straight to it) there is no previous BoutCasts page to return to, so it goes home.
const KEY = "bc_in_app_nav";

function seenNavigation(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export default function BackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const first = useRef(pathname);
  const [hasPrev, setHasPrev] = useState(false);

  useEffect(() => {
    if (pathname !== first.current) {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        // storage blocked: Back falls back to home
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasPrev(seenNavigation());
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
