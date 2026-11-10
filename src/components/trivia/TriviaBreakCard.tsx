"use client";

import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { safeHttpUrl } from "@/lib/safeUrl";
import type { TriviaBreak } from "@/lib/trivia";

// A sponsor commercial the host is playing: covers the projector (or the player's phone) until the host ends it.
export default function TriviaBreakCard({ brk, variant }: { brk: TriviaBreak; variant: "screen" | "phone" }) {
  const big = variant === "screen";
  const url = safeHttpUrl(brk.url);
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/95 p-6 text-center text-white" role="dialog" aria-label={`Commercial from ${brk.name}`}>
      <p className={`${big ? "text-2xl" : "text-xs"} font-bold uppercase tracking-widest text-white/70`}>A word from our sponsor</p>
      {brk.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brk.logo} alt={brk.name} className={`${big ? "h-24" : "h-14"} max-w-[70%] rounded-lg bg-white object-contain px-4 py-2`} />
      )}
      {!brk.logo && <p className={`${big ? "text-5xl" : "text-2xl"} font-black`}>{brk.name}</p>}
      <div className={`w-full ${big ? "max-w-4xl" : "max-w-md"}`}>
        {brk.kind === "image" && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${brk.name} commercial`} className="mx-auto max-h-[60vh] w-auto rounded-xl object-contain" />
        ) : url ? (
          <>
            <EmbeddedClipPlayer sourceUrl={url} label={`${brk.name} commercial`} />
            <a href={url} target="_blank" rel="sponsored noopener noreferrer" className="mt-3 inline-block text-sm underline">Open the commercial</a>
          </>
        ) : null}
      </div>
    </div>
  );
}
