import { createClient } from "@/lib/supabase/server";
import { loadVsForSlate, vsImage } from "@/lib/og/predVs";

// Shareable portrait VS graphic for a game room, using its first game and the room's name.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const d = await loadVsForSlate(await createClient(), id);
  if (!d) return new Response("Not found", { status: 404 });
  return vsImage(d, "story");
}
