import AdminLicenseManager from "@/components/AdminLicenseManager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLicensesPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, owner_id, seats, status, current_period_end, created_at")
    .order("created_at", { ascending: false });
  const ownerIds = Array.from(new Set((orgs ?? []).map((o) => o.owner_id)));
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", ownerIds)
    : { data: [] as { id: string; username: string }[] };
  const nameById = new Map((owners ?? []).map((o) => [o.id, o.username]));

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        School &amp; League Licenses
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Paid licenses sync from Stripe. For pilots and partners, have the school start at /org (enter
        their name, then close checkout) and comp it here.
      </p>
      <AdminLicenseManager orgs={(orgs ?? []).map((o) => ({ ...o, owner_username: nameById.get(o.owner_id) ?? null }))} />
    </div>
  );
}
