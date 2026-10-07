import { createClient } from "@/lib/supabase/server";
import { loadVsForGame, vsImage } from "@/lib/og/predVs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await loadVsForGame(await createClient(), id) : null;
  return vsImage(d ?? { home: "Home", away: "Away", homeLogo: null, awayLogo: null, whenText: "Make your picks", isPrivate: false, title: null }, "og");
}
