import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SponsorManager from "@/components/SponsorManager";

export default async function SponsorsAdminPage() {
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

  const [{ data: sponsors }, { data: categories }, { data: bouts }] = await Promise.all([
    supabase.from("sponsors").select("*").order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("bouts")
      .select("id, title, status, sponsor_id")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to bouts
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Sponsors</h1>
      <p className="mb-6 text-neutral-500">
        Manage sponsors and assign them to categories or individual bouts.
      </p>
      <SponsorManager
        initialSponsors={sponsors ?? []}
        initialCategories={categories ?? []}
        initialBouts={bouts ?? []}
      />
    </div>
  );
}
