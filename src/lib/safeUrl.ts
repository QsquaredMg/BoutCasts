// User-entered links (sponsor sites, clip sources, entry links, ad click-throughs)
// must never render as javascript:, data: or other script-bearing URLs.
// Returns a clean http(s) URL, or null when the value isn't one.
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// In-app notification links: same-site paths ("/x", not "//host") or http(s) URLs.
export function safeAppLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return v;
  return safeHttpUrl(v);
}
