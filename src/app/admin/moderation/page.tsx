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
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-neutral-500">You don&apos;t have access to this page.</p>
        <Link href="/" className="text-sm text-red-600 underline">
          Back to bouts
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to bouts
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Moderation queue</h1>
      <p className="mb-6 text-neutral-500">
        Review submissions before they go live.
      </p>
      <ModerationQueue submissions={pending ?? []} />
    </div>
  );
}
