import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TrashRestoreButton from "@/components/TrashRestoreButton";

export const metadata: Metadata = { title: "Trash" };

type Row = {
  id: string;
  title: string;
  competitor_a_name: string;
  competitor_b_name: string;
  status: string;
  bracket_key: string | null;
  created_at: string;
  deleted_at: string;
  deleted_by_name: string | null;
  votes: number;
  comments: number;
};

export default async function AdminTrashPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_trashed_bouts");
  const rows = (data ?? []) as Row[];
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        🗑 Trash
      </h1>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
        Deleted bouts land here instead of disappearing. They&apos;re hidden from the site but keep their clips, votes and
        comments. Restore puts a bout back exactly as it was. Bouts are emptied from the trash automatically after 30 days, or
        right away with &ldquo;Delete forever&rdquo;.
      </p>
      {error && (
        <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>
          {error.message}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          The trash is empty.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {r.competitor_a_name} vs {r.competitor_b_name}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
                  {r.title}
                  {r.bracket_key ? ` · bracket ${r.bracket_key}` : ""}
                </p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {r.status} · {r.votes} votes · {r.comments} comments · deleted {when(r.deleted_at)}
                  {r.deleted_by_name ? ` by ${r.deleted_by_name}` : ""}
                </p>
              </div>
              <TrashRestoreButton boutId={r.id} />
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs" style={{ color: "var(--text-faint)" }}>
        Restored bouts go back to <Link href="/admin/bouts" className="underline">Admin → Bouts</Link> and the public pages right away.
      </p>
    </div>
  );
}
