import type { Metadata } from "next";
import ScreenClient from "@/components/trivia/ScreenClient";

export const metadata: Metadata = { title: "Trivia big screen", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ScreenClient code={code.toUpperCase()} />;
}
