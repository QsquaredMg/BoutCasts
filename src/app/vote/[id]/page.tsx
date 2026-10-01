import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import LiveVoteBallot from "@/components/LiveVoteBallot";
import { roomThemeVars } from "@/lib/liveVoteEvents/roomTheme";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient({ eventId: id });
  const { data: event } = await supabase
    .from("live_vote_events")
    .select("title, brand_name, is_private")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return { title: "Live Vote", robots: { index: false } };
  }

  const title = event.title;
  const description = event.brand_name
    ? `Presented by ${event.brand_name} — cast your vote, or start your own Bout, on BoutCasts.`
    : "Cast your vote — or start your own Bout — on BoutCasts.";

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
    // Private events never appear in search results.
    ...(event.is_private ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function VotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: room } = await supabase.rpc("get_live_vote_room", { p_event_id: id });
  const theme = (room ?? {}) as {
    brand_color?: string | null;
    brand_bg_color?: string | null;
    brand_bg_image_url?: string | null;
    white_label?: boolean;
  };
  const style = roomThemeVars(
    theme.brand_color ?? null,
    theme.brand_bg_color ?? null,
    theme.brand_bg_image_url ?? null
  ) as React.CSSProperties;

  // data-white-label hides the site menu and footer (see globals.css) so the
  // organizer's brand is front and center; a small credit stays at the bottom.
  return (
    <div data-brand-room="" data-white-label={theme.white_label ? "" : undefined} className="min-h-screen" style={style}>
      <div className="mx-auto max-w-lg px-5 py-8">
        <LiveVoteBallot eventId={id} />
      </div>
      {theme.white_label && (
        <p className="pb-6 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
          Powered by{" "}
          <a href="https://www.boutcasts.com" className="font-semibold underline">
            BoutCasts
          </a>
        </p>
      )}
    </div>
  );
}
