import type { Metadata } from "next";
import BoutScreen, { type BoutBrand } from "@/components/BoutScreen";
import { safeHttpUrl } from "@/lib/safeUrl";

export const metadata: Metadata = { title: "Big screen — Bout", robots: { index: false } };

const hex = (v?: string) => (v && /^#?[0-9a-fA-F]{6}$/.test(v) ? (v.startsWith("#") ? v : `#${v}`) : undefined);

// Venue / broadcast display for a bout. Brand it with ?name=, ?logo= (https image), ?color= and ?bg= (hex).
// ?overlay=1 is a transparent lower-third for broadcast software; ?view=count is just the big counter.
export default async function BoutScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const logo = q.logo && /^https:\/\//i.test(q.logo) ? safeHttpUrl(q.logo) ?? undefined : undefined;
  const brand: BoutBrand = { name: q.name?.slice(0, 60), logo, color: hex(q.color), bg: hex(q.bg) };
  return <BoutScreen boutId={id} overlay={q.overlay === "1"} view={q.view === "count" ? "count" : "full"} brand={brand} />;
}
