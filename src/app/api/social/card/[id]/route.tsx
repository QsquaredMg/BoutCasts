import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCard } from "@/lib/og/cardRoute";
import { renderCard } from "@/lib/og/shareCard";
import { renderResultsCard } from "@/lib/social/resultsCard";
import type { SocialKind, TopRow } from "@/lib/social/types";

// The result graphic for a queued social post, as a JPEG (Instagram only accepts JPEG).
// Public on purpose: Facebook and Instagram fetch it by address. It only ever shows
// results that are already public.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const db = createAdminClient();
  const { data: p } = await db.from("social_posts").select("kind, source_id, title, winner, top10").eq("id", id).maybeSingle();
  if (!p) return new Response("Not found", { status: 404 });

  let img: Response;
  if (p.kind === "paidbout_launch") {
    const card = await loadCard("paidbout", p.source_id);
    img = card ? renderCard(card, "story") : renderResultsCard({ kind: "paidbout_launch", title: p.title, winner: null, top10: [] });
  } else if (p.kind === "bout" || p.kind === "bout_launch") {
    const card = await loadCard("bout", p.source_id);
    img = card ? renderCard(card, "story") : renderResultsCard({ kind: "bout", title: p.title, winner: p.winner, top10: p.top10 as TopRow[] });
  } else {
    img = renderResultsCard({ kind: p.kind as SocialKind, title: p.title, winner: p.winner, top10: p.top10 as TopRow[] });
  }
  const jpeg = await sharp(Buffer.from(await img.arrayBuffer())).flatten({ background: "#0a0b10" }).jpeg({ quality: 90 }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" } });
}
