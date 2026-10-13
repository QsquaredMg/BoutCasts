import { SITE } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

export function socialConfigured() {
  return {
    facebook: !!(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN),
    instagram: !!(process.env.META_IG_USER_ID && process.env.META_PAGE_ACCESS_TOKEN),
  };
}

async function graph(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: process.env.META_PAGE_ACCESS_TOKEN ?? "" }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) throw new Error(json.error?.message ?? `Meta API ${res.status}`);
  return json.id;
}

export type PlatformResult = { ok: boolean; id?: string; error?: string };

export async function postToFacebook(postId: string, caption: string): Promise<PlatformResult> {
  try {
    const id = await graph(`/${process.env.META_PAGE_ID}/photos`, { url: `${SITE}/api/social/card/${postId}`, caption, published: "true" });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function postToInstagram(postId: string, caption: string): Promise<PlatformResult> {
  try {
    const ig = process.env.META_IG_USER_ID;
    const container = await graph(`/${ig}/media`, { image_url: `${SITE}/api/social/card/${postId}`, caption });
    const id = await graph(`/${ig}/media_publish`, { creation_id: container });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
