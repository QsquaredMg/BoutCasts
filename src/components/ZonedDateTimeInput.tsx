"use client";

import { useZone } from "@/lib/time/pref";
import { formatWhen, wallToIso, zoneName, deviceZone } from "@/lib/time/zones";
import TimeZoneSelect from "./TimeZoneSelect";

/**
 * A date and time picker that always says which time zone it means.
 * `value` / `onChange` use the same "YYYY-MM-DDTHH:mm" text as a plain datetime-local input;
 * turn it into a real moment with `wallToIso(value, getZone())` when saving.
 */
export default function ZonedDateTimeInput({
  value, onChange, className, style, required, disabled, id, min, max, title, hideZone = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  min?: string;
  max?: string;
  title?: string;
  hideZone?: boolean;
}) {
  const zone = useZone();
  const iso = value ? wallToIso(value, zone) : "";
  const device = typeof window === "undefined" ? zone : deviceZone();
  const differs = !!iso && device !== zone;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} type="datetime-local" value={value} min={min} max={max} title={title} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} className={`${className ?? ""} min-w-0 flex-1`} style={style} />
        {!hideZone && <TimeZoneSelect />}
      </div>
      {!!iso && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          {formatWhen(iso, zone, { withYear: true })} · {zoneName(zone)}
          {differs ? ` · ${formatWhen(iso, device)} on your device` : ""}
        </p>
      )}
    </div>
  );
}
