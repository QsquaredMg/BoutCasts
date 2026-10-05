// Round profile photo for a Live Vote option, or the option's initials when
// there's no photo, so voters always see who they're voting for.

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (first + last).toUpperCase();
}

export default function OptionAvatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="flex-shrink-0 rounded-full border object-cover"
        style={{ width: size, height: size, borderColor: "var(--border)" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: "var(--red-soft, var(--surface-2))",
        color: "var(--red)",
        border: "1px solid var(--border)",
      }}
    >
      {initials(name)}
    </span>
  );
}
