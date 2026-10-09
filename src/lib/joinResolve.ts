import type { SupabaseClient } from "@supabase/supabase-js";

// One entry point for every way into a private thing on BoutCasts: a pasted link, a Live Vote event
// code (6 letters/numbers), a private prediction code (6 letters) or a Live Trivia game code (5).
export type JoinResult = { href: string } | { error: string };

const NOT_FOUND = "We couldn't find anything open with that code. Check it and try again.";

export async function resolveJoin(raw: string, supabase: SupabaseClient, currentHost?: string): Promise<JoinResult> {
  const input = raw.trim();
  if (!input) return { error: "Enter your code or paste the link you were sent." };

  // A pasted link (or "boutcasts.com/..."): stay on the site, go where it points.
  if (/^https?:\/\//i.test(input) || /boutcasts\.com/i.test(input) || input.startsWith("/")) {
    try {
      const u = input.startsWith("/") ? new URL(input, "https://www.boutcasts.com") : new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      const host = u.hostname.toLowerCase();
      const ours = host === "boutcasts.com" || host.endsWith(".boutcasts.com") || (!!currentHost && host === currentHost.toLowerCase());
      if (!ours) return { error: "That link isn't a BoutCasts link. Paste the one you were sent, or type the code." };
      return { href: `${u.pathname}${u.search}` || "/" };
    } catch {
      return { error: "That link doesn't look right. Paste the whole thing, or type the code." };
    }
  }

  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (code.length === 5) {
    const { data } = await supabase.rpc("trivia_state", { p_code: code });
    if (data) return { href: `/trivia/${code}/play` };
    return { error: NOT_FOUND };
  }

  if (code.length === 6) {
    const ev = await supabase.rpc("find_event_by_code", { p_code: code });
    if (typeof ev.data === "string" && ev.data) return { href: `/vote/${ev.data}` };
    if (/^[A-Z]{6}$/.test(code)) {
      const pr = await supabase.rpc("pred_slate_by_code", { p_code: code });
      if (typeof pr.data === "string" && pr.data) return { href: `/predictions/slate/${pr.data}` };
    }
    return { error: NOT_FOUND };
  }

  return { error: "Codes are 5 or 6 letters and numbers. Or paste the link you were sent." };
}
