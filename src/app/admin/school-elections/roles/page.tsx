import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminSchoolTabs from "@/components/AdminSchoolTabs";
import AdminRolePlanControls from "@/components/AdminRolePlanControls";
import { roleLabel } from "@/lib/electionRoles";

export const dynamic = "force-dynamic";

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

// Admin view of the Student Roles package: who has the plan, what each election is using, and the gifts raised.
export default async function AdminStudentRolesPage() {
  const admin = createAdminClient();
  const [{ data: plans }, { data: elections }, { data: events }] = await Promise.all([
    admin.from("school_role_plans").select("user_id, status, current_period_end, cancel_at_period_end, updated_at").order("updated_at", { ascending: false }),
    admin.from("school_elections").select("id, title, school_name, organizer_id, status, created_at, election_class_label, voting_group_label, grade_level, fundraiser_enabled, fundraiser_goal_cents, is_practice").order("created_at", { ascending: false }).limit(200),
    admin.from("election_role_events").select("election_id, role, action, label, created_at").order("created_at", { ascending: false }).limit(40),
  ]);

  const ids = (elections ?? []).map((e) => e.id);
  const userIds = Array.from(new Set([...(plans ?? []).map((p) => p.user_id), ...(elections ?? []).map((e) => e.organizer_id)]));
  const [{ data: profs }, { data: seats }, { data: surveys }, { data: responses }, { data: races }] = await Promise.all([
    userIds.length ? admin.from("profiles").select("id, username").in("id", userIds) : Promise.resolve({ data: [] as { id: string; username: string }[] }),
    ids.length ? admin.from("election_staff").select("election_id, role").in("election_id", ids).is("revoked_at", null) : Promise.resolve({ data: [] as { election_id: string; role: string }[] }),
    ids.length ? admin.from("election_surveys").select("election_id, status").in("election_id", ids) : Promise.resolve({ data: [] as { election_id: string; status: string }[] }),
    ids.length ? admin.from("election_survey_responses").select("election_id").in("election_id", ids).limit(100000) : Promise.resolve({ data: [] as { election_id: string }[] }),
    ids.length ? admin.from("live_vote_events").select("id, election_id").in("election_id", ids) : Promise.resolve({ data: [] as { id: string; election_id: string }[] }),
  ]);
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: gifts } = raceIds.length
    ? await admin.from("live_vote_super_votes").select("event_id, amount_cents, organizer_share_cents").in("event_id", raceIds).limit(100000)
    : { data: [] as { event_id: string; amount_cents: number; organizer_share_cents: number }[] };

  const user = new Map((profs ?? []).map((p) => [p.id, p.username]));
  const raceElection = new Map((races ?? []).map((r) => [r.id, r.election_id]));
  const seatCount = new Map<string, number>();
  for (const s of seats ?? []) seatCount.set(s.election_id, (seatCount.get(s.election_id) ?? 0) + 1);
  const surveyStatus = new Map((surveys ?? []).map((s) => [s.election_id, s.status]));
  const answers = new Map<string, number>();
  for (const r of responses ?? []) answers.set(r.election_id, (answers.get(r.election_id) ?? 0) + 1);
  const money = new Map<string, { gross: number; share: number; n: number }>();
  for (const g of gifts ?? []) {
    const eid = raceElection.get(g.event_id);
    if (!eid) continue;
    const m = money.get(eid) ?? { gross: 0, share: 0, n: 0 };
    m.gross += g.amount_cents;
    m.share += g.organizer_share_cents;
    m.n += 1;
    money.set(eid, m);
  }
  const electionTitle = new Map((elections ?? []).map((e) => [e.id, e.title]));

  let totalGross = 0, totalShare = 0, totalGifts = 0;
  for (const m of money.values()) { totalGross += m.gross; totalShare += m.share; totalGifts += m.n; }
  const live = (plans ?? []).filter((p) => p.status === "comp" || (["active", "trialing", "past_due"].includes(p.status) && (!p.current_period_end || new Date(p.current_period_end) > new Date())));
  const paid = live.filter((p) => p.status !== "comp").length;

  const card = "rounded-xl border p-4";
  const cell = { borderColor: "var(--border)" };

  return (
    <div>
      <AdminSchoolTabs active="roles" />
      <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Student Roles & Money</h2>
      <p className="mb-5 mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
        The $750/year Student Roles plan, the seats and surveys each election is using, and the Spirit Award gifts raised. Gifts never count as votes.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={card} style={cell}><p className="text-xs" style={{ color: "var(--text-faint)" }}>Active plans</p><p className="text-2xl font-extrabold">{live.length}</p><p className="text-xs" style={{ color: "var(--text-faint)" }}>{paid} paid, {live.length - paid} free</p></div>
        <div className={card} style={cell}><p className="text-xs" style={{ color: "var(--text-faint)" }}>Gifts raised</p><p className="text-2xl font-extrabold">{usd(totalGross)}</p><p className="text-xs" style={{ color: "var(--text-faint)" }}>{totalGifts} gifts</p></div>
        <div className={card} style={cell}><p className="text-xs" style={{ color: "var(--text-faint)" }}>Owed to schools</p><p className="text-2xl font-extrabold">{usd(totalShare)}</p><p className="text-xs" style={{ color: "var(--text-faint)" }}>96% of gifts</p></div>
        <div className={card} style={cell}><p className="text-xs" style={{ color: "var(--text-faint)" }}>BoutCasts share</p><p className="text-2xl font-extrabold">{usd(totalGross - totalShare)}</p><p className="text-xs" style={{ color: "var(--text-faint)" }}>before payment fees</p></div>
      </div>

      <h3 className="mb-2 text-lg font-bold">Plans</h3>
      <div className="mb-3"><AdminRolePlanControls /></div>
      <div className="mb-8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead style={{ color: "var(--text-faint)" }}><tr><th className="py-2">Organizer</th><th>Status</th><th>Renews or ends</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {(plans ?? []).map((p) => (
              <tr key={p.user_id} className="border-t" style={cell}>
                <td className="py-2.5 font-semibold">{user.get(p.user_id) ?? p.user_id.slice(0, 8)}</td>
                <td>{p.status === "comp" ? "Free (granted)" : p.status}{p.cancel_at_period_end ? " · cancels at period end" : ""}</td>
                <td>{p.status === "comp" ? "No end" : day(p.current_period_end)}</td>
                <td>{day(p.updated_at)}</td>
                <td className="text-right">{p.status === "comp" && <AdminRolePlanControls userId={p.user_id} />}</td>
              </tr>
            ))}
            {(plans ?? []).length === 0 && <tr><td colSpan={5} className="py-5 text-center" style={{ color: "var(--text-faint)" }}>No plans yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-lg font-bold">Elections</h3>
      <div className="mb-8 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead style={{ color: "var(--text-faint)" }}>
            <tr><th className="py-2">Election</th><th>Organizer</th><th>Election class → voting group</th><th>Seats</th><th>Survey</th><th>Gifts</th><th>School share</th><th /></tr>
          </thead>
          <tbody>
            {(elections ?? []).filter((e) => !e.is_practice).map((e) => {
              const m = money.get(e.id);
              return (
                <tr key={e.id} className="border-t" style={cell}>
                  <td className="py-2.5"><p className="font-semibold">{e.title}</p><p className="text-xs" style={{ color: "var(--text-faint)" }}>{e.school_name ?? "No school name"} · {e.status}</p></td>
                  <td>{user.get(e.organizer_id) ?? "—"}</td>
                  <td>{e.election_class_label || e.voting_group_label ? `${e.election_class_label ?? "?"} → ${e.voting_group_label ?? "?"}` : "Not set"}{e.grade_level ? ` (${e.grade_level})` : ""}</td>
                  <td>{seatCount.get(e.id) ?? 0}</td>
                  <td>{surveyStatus.get(e.id) ?? "None"}{answers.get(e.id) ? ` · ${answers.get(e.id)} answers` : ""}</td>
                  <td>{m ? `${usd(m.gross)} (${m.n})` : e.fundraiser_enabled ? "$0.00" : "Off"}</td>
                  <td>{m ? usd(m.share) : "—"}</td>
                  <td className="text-right"><Link href={`/school-election/${e.id}`} className="font-bold underline">Open</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-lg font-bold">Recent role activity</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead style={{ color: "var(--text-faint)" }}><tr><th className="py-2">When</th><th>Election</th><th>Role</th><th>What</th></tr></thead>
          <tbody>
            {(events ?? []).map((ev, i) => (
              <tr key={i} className="border-t" style={cell}>
                <td className="py-2">{new Date(ev.created_at).toLocaleString()}</td>
                <td>{electionTitle.get(ev.election_id) ?? "—"}</td>
                <td>{ev.role ? roleLabel(ev.role) : "—"}</td>
                <td>{ev.action.replace("_", " ")}{ev.label ? ` · ${ev.label}` : ""}</td>
              </tr>
            ))}
            {(events ?? []).length === 0 && <tr><td colSpan={4} className="py-5 text-center" style={{ color: "var(--text-faint)" }}>No role activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
