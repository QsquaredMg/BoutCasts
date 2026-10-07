import { NextResponse } from "next/server";
import { getActor } from "@/lib/paidBoutsServer";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only: one-hour signed links for the clip files in a dump, so they can be downloaded before purging.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, isAdmin } = await getActor();
  if (!user || !isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const admin = createAdminClient();
  const { data: dump } = await admin.from("archive_dumps").select("files, purged_at").eq("id", id).maybeSingle();
  if (!dump) return NextResponse.json({ error: "Dump not found" }, { status: 404 });
  const files = (dump.files ?? []) as { bucket: string; path: string }[];
  const out = await Promise.all(
    files.map(async (f) => {
      const { data } = await admin.storage.from(f.bucket).createSignedUrl(decodeURIComponent(f.path), 3600, { download: true });
      return { ...f, name: decodeURIComponent(f.path).split("/").pop() ?? f.path, url: data?.signedUrl ?? null };
    }),
  );
  return NextResponse.json({ files: out });
}
