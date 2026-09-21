import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ModerationQueue from "@/components/ModerationQueue";

export default async function ModerationPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <p style={{ color: "var(--text-faint)" }}>You don&apos;t have access to this page.</p>
        <Link href="/" className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
          Back to matchups
        </Link>
      </div>
    );
  }

  const { data: pending } = await supabase
    .from("submissions")
    .select("*, categories(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Moderation queue</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Review submissions before they go live.
      </p>
      <ModerationQueue submissions={pending ?? []} />
    </div>
  );
}
