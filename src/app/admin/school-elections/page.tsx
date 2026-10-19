import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

const isPast = (iso: string | null) => !!iso && new Date(iso).getTime() <= Date.now();
const money = (c: number) => (c ? `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "Free");

export default async function AdminSchoolElectionsPage() {
  const admin = createAdminClient();
  const { data: elections } = await admin
    .from("school_elections")
    .select("id, title, school_name, tier, kiosks, days, price_cents, status, closes_at, created_at, organizer_id, stripe_checkout_session_id, open_ended")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (elections ?? []).map((e) => e.id);
  const orgIds = Array.from(new Set((elections ?? []).map((e) => e.organizer_id)));
  const [{ data: voters }, { data: orgs }, { data: kiosks }] = await Promise.all([
    ids.length ? admin.from("election_voters").select("election_id, voted_at").in("election_id", ids).limit(100000) : Promise.resolve({ data: [] as { election_id: string; voted_at: string | null }[] }),
    orgIds.length ? admin.from("profiles").select("id, username").in("id", orgIds) : Promise.resolve({ data: [] as { id: string; username: string }[] }),
    ids.length ? admin.from("election_kiosks").select("election_id").in("election_id", ids) : Promise.resolve({ data: [] as { election_id: string }[] }),
  ]);
  const turnout = new Map<string, { total: number; voted: number }>();
  for (const v of voters ?? []) {
    const t = turnout.get(v.election_id) ?? { total: 0, voted: 0 };
    t.total++;
    if (v.voted_at) t.voted++;
    turnout.set(v.election_id, t);
  }
  const kioskCount = new Map<string, number>();
  for (const k of kiosks ?? []) kioskCount.set(k.election_id, (kioskCount.get(k.election_id) ?? 0) + 1);
  const user = new Map((orgs ?? []).map((o) => [o.id, o.username]));

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>School Elections</h2>
        <Link href="/school-election/new" className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">+ Set up a school kiosk election</Link>
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Every kiosk election on the platform. Open one to manage its roster, pair iPads, add staff seats or close it.
        Elections you create here show &ldquo;Open with no charge (admin)&rdquo; on their page, so you can set one up for a partner school.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead style={{ color: "var(--text-faint)" }}>
            <tr><th className="py-2">Election</th><th>Organizer</th><th>Size</th><th>Kiosks</th><th>Price</th><th>Turnout</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {(elections ?? []).map((e) => {
              const t = turnout.get(e.id) ?? { total: 0, voted: 0 };
              const closed = e.status === "closed" || isPast(e.closes_at);
              const status = e.status === "draft" ? "Draft" : closed ? "Closed" : "Live";
              return (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2.5">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>{e.school_name ?? "No school name"} · {new Date(e.created_at).toLocaleDateString()}</p>
                  </td>
                  <td>{user.get(e.organizer_id) ?? "—"}</td>
                  <td className="capitalize">{e.tier}, {e.open_ended ? "no end" : `${e.days}d`}</td>
                  <td>{kioskCount.get(e.id) ?? 0} of {e.kiosks}</td>
                  <td>{money(e.price_cents)}{e.stripe_checkout_session_id === "admin" ? " (comp)" : ""}</td>
                  <td>{t.voted} / {t.total}</td>
                  <td>{status}{status === "Live" && e.open_ended ? " · open until closed" : status === "Live" && e.closes_at ? ` · ends ${new Date(e.closes_at).toLocaleString()}` : ""}</td>
                  <td className="text-right"><Link href={`/school-election/${e.id}`} className="font-bold underline">Open</Link></td>
                </tr>
              );
            })}
            {(elections ?? []).length === 0 && <tr><td colSpan={8} className="py-6 text-center" style={{ color: "var(--text-faint)" }}>No school elections yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
