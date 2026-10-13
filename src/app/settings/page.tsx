import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BlockedUsersList from "@/components/settings/BlockedUsersList";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

export const metadata: Metadata = {
  title: "Settings & safety",
  robots: { index: false },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-5 py-10">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Settings &amp; safety
        </h1>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Signed in as {user.email}
          {profile?.username && (
            <>
              {" "}&middot;{" "}
              <Link href={`/profile/${encodeURIComponent(profile.username)}`} className="underline">
                @{profile.username}
              </Link>
            </>
          )}
        </p>
      </div>

      <BlockedUsersList />

      <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Report a problem
        </h2>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Use the Report button on any bout, comment or profile. For anything urgent, email{" "}
          <a href="mailto:support@boutcasts.com" className="underline">support@boutcasts.com</a>. We review reports and
          remove content that breaks our <Link href="/rules" className="underline">rules</Link>.
        </p>
      </section>

      <DeleteAccountSection />
    </div>
  );
}
