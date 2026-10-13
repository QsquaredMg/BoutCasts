import type { Metadata } from "next";
import { cardMetadata } from "@/lib/og/cardRoute";
import PlayClient from "@/components/trivia/PlayClient";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return (await cardMetadata("trivia", code.toUpperCase(), "Live Trivia on BoutCasts")) as Metadata;
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayClient code={code.toUpperCase()} />;
}
