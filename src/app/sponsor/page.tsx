import type { Metadata } from "next";
import Link from "next/link";
import SponsorApplyForm from "@/components/SponsorApplyForm";

export const metadata: Metadata = {
  title: "Sponsor BoutCasts",
  description: "Put your brand in front of fans at band battles, halftime shows and school events. Sponsor a category or a live vote.",
};

export default async function SponsorPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Sponsor a category
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Put your brand in front of an engaged, competitive crowd. Pick a tier below to get
        started — we&apos;ll follow up to activate your logo, links, and placement.
      </p>

      {checkout === "success" && (
        <p
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          Payment received — thanks! Our team will reach out shortly to finish setting up your
          sponsorship.
        </p>
      )}
      {checkout === "cancelled" && (
        <p
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}
        >
          Checkout was cancelled — no charge was made. Feel free to try again below.
        </p>
      )}

      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Already a sponsor?{" "}
        <Link href="/sponsor/creatives" className="font-semibold underline">
          Upload and track your ads
        </Link>
        .
      </p>

      <SponsorApplyForm />
    </div>
  );
}
