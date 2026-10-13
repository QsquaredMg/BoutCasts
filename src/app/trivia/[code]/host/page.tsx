import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HostClient from "@/components/trivia/HostClient";

export const metadata: Metadata = { title: "Host trivia", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const C = code.toUpperCase();
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) redirect(`/login?next=/trivia/${C}/host`);
  const { data: g } = await supabase.from("trivia_games").select("id").eq("code", C).maybeSingle();
  // Only the host (or an admin) can read the game row; everyone else is sent to play.
  if (!g) redirect(`/trivia/${C}/play`);
  return <HostClient code={C} gameId={g.id} />;
}
