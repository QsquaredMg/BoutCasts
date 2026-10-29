import type { Metadata } from "next";
import LiveVoteScreen from "@/components/LiveVoteScreen";

export const metadata: Metadata = { title: "Big screen — Live Vote", robots: { index: false } };

// Venue display for a Live Vote: a giant QR code to scan and the live results. No login needed.
export default async function LiveVoteScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveVoteScreen eventId={id} />;
}
