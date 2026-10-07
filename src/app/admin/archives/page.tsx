import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ArchivesManager, { type Dump, type ArchivedItem } from "@/components/ArchivesManager";

export const metadata: Metadata = { title: "Archives" };

export default async function AdminArchivesPage() {
  const supabase = await createClient();
  const [{ data: dumps, error }, { data: items }] = await Promise.all([
    supabase
      .from("archive_dumps")
      .select("id, created_at, trigger, counts, files, payload_bytes, downloaded_at, purged_at, purge_summary, files_purged_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("admin_list_archived"),
  ]);
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>📦 Archives</h1>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
        Archived bouts, live votes and predictions are hidden from the site right away and can be restored. On the 1st of each month
        (and whenever you press Run), finished items older than 90 days plus everything you archived are bundled into a downloadable dump.
        Nothing is deleted until you download the dump and confirm. Items with payment records are kept.
      </p>
      {error && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{error.message}</p>}
      <ArchivesManager dumps={(dumps ?? []) as Dump[]} items={(items ?? []) as ArchivedItem[]} />
    </div>
  );
}
