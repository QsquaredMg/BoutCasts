import type { Metadata } from "next";
import Link from "next/link";
import AdminBulkGames from "@/components/AdminBulkGames";

export const metadata: Metadata = {
  title: "Add many prediction games",
  description: "Admin tool to create up to 50 prediction games at once from pasted lines or a CSV, with team logos filled in.",
};

export default function AdminBulkGamesPage() {
  return (
    <div>
      <Link href="/admin/predictions" className="mb-3 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Add many games</h2>
      <p className="mb-5 text-sm" style={{ color: "var(--text-faint)" }}>
        Paste a list or upload a CSV, review the preview, then create up to 50 games in one go. Predictions on each game close 15 minutes after its start time.
      </p>
      <AdminBulkGames />
    </div>
  );
}
