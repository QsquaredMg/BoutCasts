import { NextResponse } from "next/server";
import { getActor } from "@/lib/paidBoutsServer";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildArchiveZip } from "@/lib/archiveZip";

// Admin-only: the dump's data as a zip (JSON + CSV per table). Marks the dump as downloaded,
// which is what unlocks the purge step.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, isAdmin } = await getActor();
  if (!user || !isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: dump }, { data: pay }] = await Promise.all([
    admin.from("archive_dumps").select("id, created_at, counts, files, purged_at").eq("id", id).maybeSingle(),
    admin.from("archive_payloads").select("payload").eq("dump_id", id).maybeSingle(),
  ]);
  if (!dump) return NextResponse.json({ error: "Dump not found" }, { status: 404 });
  if (!pay?.payload) return NextResponse.json({ error: "This dump was already purged, so its data is no longer stored." }, { status: 410 });

  const zip = buildArchiveZip(dump, pay.payload as Record<string, unknown>, ((dump.files ?? []) as { bucket: string; path: string }[]).map((f) => ({ ...f, url: null })));
  await admin.from("archive_dumps").update({ downloaded_at: new Date().toISOString() }).eq("id", id).is("downloaded_at", null);
  const day = new Date(dump.created_at).toISOString().slice(0, 10);
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="boutcasts-archive-${day}-${id.slice(0, 8)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
