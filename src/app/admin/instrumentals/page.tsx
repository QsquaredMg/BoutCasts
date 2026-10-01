import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InstrumentalAdmin from "@/components/InstrumentalAdmin";
import InstrumentalUpload from "@/components/InstrumentalUpload";
import type { Instrumental } from "@/lib/types";

// Admin access is enforced by src/app/admin/layout.tsx.
export default async function InstrumentalsAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instrumentals")
    .select("*")
    .order("created_at", { ascending: false });
  const items = (data as Instrumental[] | null) ?? [];

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Instrumentals</h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Approve beats submitted by producers and organizers. Only approved tracks appear in the bout picker.
        {" "}{items.filter((i) => i.status === "pending").length} pending.
      </p>
      <p className="mb-4 text-sm">
        <Link href="/admin/instrumentals/report" className="font-semibold underline" style={{ color: "var(--blue)" }}>
          Producer reports
        </Link>
      </p>
      <InstrumentalAdmin initial={items} />
      <h3 className="mb-2 mt-8 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Upload a track</h3>
      <InstrumentalUpload />
    </div>
  );
}
