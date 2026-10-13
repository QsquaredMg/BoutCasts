"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ZONE, deviceZone, isValidZone } from "./zones";

const KEY = "bc_tz";
const EVENT = "bc-tz-change";

/** The viewer's chosen zone, or their device's zone when they have not chosen one. */
export function getZone(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && isValidZone(saved)) return saved;
  } catch {}
  return deviceZone();
}

export function setZone(id: string) {
  try { localStorage.setItem(KEY, id); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Reactive zone. Server and first paint use Central so markup matches, then it settles. */
export function useZone(): string {
  return useSyncExternalStore(subscribe, getZone, () => DEFAULT_ZONE);
}
