import { NextResponse } from "next/server";
import { getActor } from "@/lib/paidBoutsServer";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only: after the dump was downloaded, delete the archived rows and then the clip files.
// Items with payment records are kept. The database function refuses if the dump was never downloaded.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, isAdmin } = await getActor();
  if (!user || !isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const admin = createAdminClient();
  let result: { deleted: Record<string, number>; kept: unknown[]; files: { bucket: string; path: string }[] };
  if (new URL(req.url).searchParams.get("retry") === "1") {
    // Re-try deleting clip files that failed last time (rows were already purged).
    const { data: d } = await admin.from("archive_dumps").select("files, purged_at, files_purged_at").eq("id", id).maybeSingle();
    if (!d?.purged_at || d.files_purged_at) return NextResponse.json({ error: "Nothing left to clean up." }, { status: 400 });
    result = { deleted: {}, kept: [], files: (d.files ?? []) as { bucket: string; path: string }[] };
  } else {
    const { data, error } = await supabase.rpc("admin_archive_purge", { p_dump: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    result = data as typeof result;
  }

  const byBucket = new Map<string, string[]>();
  for (const f of result.files ?? []) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), decodeURIComponent(f.path)]);
  let removed = 0;
  let failed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const { data: gone, error: rmErr } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (rmErr) failed += paths.slice(i, i + 100).length;
      else removed += gone?.length ?? 0;
    }
  }
  if (failed === 0) await supabase.rpc("admin_archive_files_done", { p_dump: id });
  return NextResponse.json({ deleted: result.deleted, kept: result.kept, filesRemoved: removed, filesFailed: failed });
}
