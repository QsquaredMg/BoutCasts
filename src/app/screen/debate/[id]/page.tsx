import type { Metadata } from "next";
import ContestScreen, { type ContestBrand } from "@/components/ContestScreen";
import { safeHttpUrl } from "@/lib/safeUrl";

export const metadata: Metadata = { title: "Big screen", robots: { index: false } };

const hex = (v?: string) => (v && /^#?[0-9a-fA-F]{6}$/.test(v) ? (v.startsWith("#") ? v : `#${v}`) : undefined);

// Venue / broadcast display. Brand with ?name=, ?logo= (https), ?color=, ?bg= (hex). ?overlay=1 = transparent lower-third, ?view=count = big counter.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const q = await searchParams;
  const logo = q.logo && /^https:\/\//i.test(q.logo) ? safeHttpUrl(q.logo) ?? undefined : undefined;
  const brand: ContestBrand = { name: q.name?.slice(0, 60), logo, color: hex(q.color), bg: hex(q.bg) };
  return <ContestScreen kind="debate" id={id} overlay={q.overlay === "1"} view={q.view === "count" ? "count" : "full"} brand={brand} />;
}
