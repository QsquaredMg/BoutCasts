import type { Metadata } from "next";
import Link from "next/link";
import JoinByCode from "@/components/JoinByCode";

export const metadata: Metadata = {
  title: "Join a private prediction game",
  description: "Enter the 6-letter code from your invite to join a private prediction game.",
  robots: { index: false },
};

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Join a private game</h1>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>Enter the 6-letter code from your invite. Private games are always free for players.</p>
      <JoinByCode />
    </div>
  );
}
