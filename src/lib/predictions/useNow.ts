"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
}

/** Current time in whole seconds, ticking every second (0 on the server). */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );
}

export function countdown(ms: number): string {
  if (ms <= 0) return "Picks closed";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m left to pick`;
  if (h > 0) return `${h}h ${m}m ${sec}s left to pick`;
  return `${m}m ${sec}s left to pick`;
}
