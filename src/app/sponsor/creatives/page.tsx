import type { Metadata } from "next";
import SponsorCreatives from "@/components/SponsorCreatives";

export const metadata: Metadata = {
  title: "Your ad creatives",
  description: "Upload and track your sponsor ads on BoutCasts.",
  robots: { index: false },
};

export default function SponsorCreativesPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Your ad creatives
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Upload the ads that run with your sponsorship. We review each one before it goes live, and
        you can watch delivery here.
      </p>
      <SponsorCreatives />
    </div>
  );
}
