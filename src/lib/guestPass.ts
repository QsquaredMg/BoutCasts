"use client";

// Guest pass: people can vote from a shared link without an account. The device keeps a random
// token (votes are tied to its hash) and a small profile so we only ask for a name once.
export const GUEST_TOKEN_KEY = "bc_guest_vote_token";
const PROFILE_KEY = "bc_guest_profile";

export function getGuestToken(): string {
  try {
    let t = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!t) {
      t = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      localStorage.setItem(GUEST_TOKEN_KEY, t);
    }
    return t;
  } catch {
    return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  }
}

export function readGuestProfile(): { name: string; email: string } {
  try {
    const j = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}");
    return { name: String(j.name ?? ""), email: String(j.email ?? "") };
  } catch {
    return { name: "", email: "" };
  }
}

export function saveGuestProfile(p: { name: string; email?: string }) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: p.name, email: p.email ?? "" }));
  } catch {}
}

export function clearGuestIdentity() {
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {}
}

/** Sign-up link that already knows the guest's email, so finishing an account is quick. */
export function signupHref(next: string): string {
  const p = readGuestProfile();
  const q = new URLSearchParams({ next });
  if (p.email) q.set("email", p.email);
  return `/signup?${q.toString()}`;
}

/** "guest_limit: You've used…" -> the part after the code. */
export function rpcMessage(msg: string | undefined, fallback: string): string {
  const m = (msg ?? "").replace(/^[a-z_]+:\s*/i, "").trim();
  return m || fallback;
}
