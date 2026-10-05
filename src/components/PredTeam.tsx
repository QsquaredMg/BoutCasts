// Team name + logo (falls back to a monogram tile when there is no logo).
export default function PredTeam({
  name,
  logo,
  size = 56,
  align = "center",
}: {
  name: string;
  logo: string | null;
  size?: number;
  align?: "center" | "left";
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "center" ? "flex-col text-center" : ""}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-xl border bg-white object-contain p-1"
          style={{ width: size, height: size, borderColor: "var(--border)" }}
        />
      ) : (
        <span
          aria-hidden
          className="flex shrink-0 items-center justify-center rounded-xl text-sm font-black"
          style={{ width: size, height: size, background: "var(--surface-2)", color: "var(--text-dim)", fontFamily: "var(--font-display)" }}
        >
          {initials}
        </span>
      )}
      <span className="min-w-0 break-words text-sm font-bold leading-tight">{name}</span>
    </div>
  );
}
