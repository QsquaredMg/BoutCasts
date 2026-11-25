import type { Metadata } from "next";
import LiveVoteScreen from "@/components/LiveVoteScreen";

export const metadata: Metadata = { title: "Big screen — Live Vote", robots: { index: false } };

// Venue display for a Live Vote: a giant QR code to scan and the live results. No login needed.
// ?overlay=1 is a transparent lower-third for broadcast software; ?view=count is just the big counter.
export default async function LiveVoteScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ overlay?: string; view?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  return <LiveVoteScreen eventId={id} overlay={q.overlay === "1"} view={q.view === "count" ? "count" : "full"} />;
}
