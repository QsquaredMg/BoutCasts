"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import JoinBox from "@/components/JoinBox";

function JoinPageInner() {
  const params = useSearchParams();
  const initial = (params.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-5 py-14 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        🔒
      </div>
      <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Join
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        Type the code you were given, or paste the link. Works for school and private events, prediction games and live trivia. No account needed to get in.
      </p>
      <div className="mt-6 w-full">
        <JoinBox initial={initial} notFound={!!params.get("notfound")} autoFocus />
      </div>
      <p className="mt-8 text-xs" style={{ color: "var(--text-faint)" }}>
        Private events don&apos;t appear anywhere public on BoutCasts. Only people with the link, code or QR code can vote.
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  );
}
