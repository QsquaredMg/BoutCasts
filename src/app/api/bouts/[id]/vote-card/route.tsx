import { createClient } from "@/lib/supabase/server";
import { loadBoutCard } from "@/lib/og/shareData";
import { renderCard } from "@/lib/og/shareCard";

export const runtime = "nodejs";

// The "Vote graphic" for a bout: same card as the link preview, in portrait.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const card = await loadBoutCard(supabase, id);
  if (!card) return new Response("Not found", { status: 404 });
  // Each fetch of this graphic is someone opening or saving it — count it for sponsor reports.
  await supabase.rpc("log_share", { p_type: "bout", p_id: id, p_action: "save_graphic" });
  return renderCard(card, "story");
}
