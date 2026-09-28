import type { Metadata } from "next";
import CompetitionManager from "@/components/CompetitionManager";

export const metadata: Metadata = { title: "Manage competition", robots: { index: false } };

export default async function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <CompetitionManager categoryId={id} />
    </div>
  );
}
