"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Shows a timestamp in the viewer's own time zone (server renders a stable UTC fallback).
export default function LocalTime({ iso, withDate = true }: { iso: string; withDate?: boolean }) {
  const text = useSyncExternalStore(
    subscribe,
    () =>
      new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        month: withDate ? "short" : undefined,
        day: withDate ? "numeric" : undefined,
        hour: "numeric",
        minute: "2-digit",
      }),
    () => new Date(iso).toUTCString().slice(0, 22) + " UTC",
  );
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
