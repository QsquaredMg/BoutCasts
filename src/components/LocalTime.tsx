"use client";

import { useZone } from "@/lib/time/pref";
import { formatWhen } from "@/lib/time/zones";

// A moment shown in the viewer's chosen time zone, always with the zone name (for example "7:00 PM CT").
export default function LocalTime({ iso, withDate = true, withYear = false }: { iso: string; withDate?: boolean; withYear?: boolean }) {
  const zone = useZone();
  return <time dateTime={iso} suppressHydrationWarning>{formatWhen(iso, zone, { withDate, withYear })}</time>;
}
