import { createClient } from "@/lib/supabase/server";
import { CARD_LOADERS } from "@/lib/og/shareData";
import { EMPTY_CARD, cardMeta, renderCard, type CardData } from "@/lib/og/shareCard";

export type CardKind = keyof typeof CARD_LOADERS;

export async function loadCard(kind: CardKind, id: string, imgs = true): Promise<CardData | null> {
  try {
    const supabase = await createClient(kind === "livevote" ? { eventId: id } : undefined);
    return await CARD_LOADERS[kind](supabase, id, imgs);
  } catch {
    return null;
  }
}

/** The link-preview image (1200x630). Falls back to a plain BoutCasts card. */
export async function ogResponse(kind: CardKind, id: string) {
  return renderCard((await loadCard(kind, id)) ?? EMPTY_CARD, "og");
}

/** The shareable portrait graphic (1080x1350); 404 when the thing doesn't exist. */
export async function storyResponse(kind: CardKind, id: string) {
  const d = await loadCard(kind, id);
  if (!d) return new Response("Not found", { status: 404 });
  return renderCard(d, "story");
}

/** Page title, description and social tags that say what kind of event this is and when it runs. */
export async function cardMetadata(kind: CardKind, id: string, headline: string, extra: Record<string, unknown> = {}) {
  const d = await loadCard(kind, id, false);
  if (!d) return { title: headline, ...extra };
  const { title, description } = cardMeta(d, headline);
  return { title, description, openGraph: { title, description }, twitter: { title, description }, ...extra };
}
