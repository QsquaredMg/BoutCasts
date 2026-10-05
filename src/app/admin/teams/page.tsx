import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import AdminTeamsManager from "@/components/AdminTeamsManager";
import { TEAM_FIELDS, type DirectoryTeam } from "@/lib/teams/directory";

export const metadata: Metadata = { title: "Admin teams", description: "Manage the NCAA, NFL, NBA and MLB team directory used when creating bouts and predictions." };

export default async function AdminTeamsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_directory").select(TEAM_FIELDS).order("league").order("name").limit(2000);
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Team directory</h2>
      <p className="mb-5 text-sm" style={{ color: "var(--text-faint)" }}>
        NCAA Division I, NFL, NBA and MLB teams that organizers can pick when creating bouts and predictions. Fix names, swap logos, hide a team or add your own.
      </p>
      {error && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{error.message}</p>}
      <AdminTeamsManager initial={(data ?? []) as DirectoryTeam[]} />
    </div>
  );
}
