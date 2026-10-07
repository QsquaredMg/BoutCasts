// Tiny user-agent helpers for analytics. No fingerprinting: we only keep a
// coarse device class and drop obvious crawlers so reports aren't inflated.

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|monitor|uptime|curl|wget|python|node-fetch|axios|go-http|okhttp|java\/|vercel|pingdom|gtmetrix|screenshot|embedly|whatsapp|telegram|discord|skype|bing|yandex|baidu|duckduck/i;

export function isBot(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_RE.test(ua);
}

export function deviceFromUa(ua: string | null | undefined): "mobile" | "tablet" | "desktop" {
  const s = ua ?? "";
  if (/ipad|tablet|playbook|silk/i.test(s) || (/android/i.test(s) && !/mobile/i.test(s))) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(s)) return "mobile";
  return "desktop";
}

export const SID_RE = /^[A-Za-z0-9-]{8,64}$/;

export function sidFromCookieHeader(cookie: string | null): string | null {
  if (!cookie) return null;
  const m = cookie.match(/(?:^|;\s*)bc_sid=([A-Za-z0-9-]{8,64})/);
  return m ? m[1] : null;
}

export function pathFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const p = new URL(referer).pathname;
    return p.length <= 300 ? p : null;
  } catch {
    return null;
  }
}
