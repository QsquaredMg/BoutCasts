// Validates a post-login "next" destination so it can only ever point back into
// this site (a same-origin path like "/live-vote/new"), never to another host.
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
