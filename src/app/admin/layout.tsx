import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import PageShell from "@/components/pagetheme/PageShell";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
        <Link href="/matchups" className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
          Back to matchups
        </Link>
      </div>
    );
  }

  return (
    <PageShell
      theme="main"
      name="Bout"
      accent="Casts Admin"
      tagline="Staff only."
      bandWidth="48rem"
      tabs={[
        { href: "/admin", label: "Dashboard", match: ["/admin$"] },
        { href: "/admin/moderation", label: "Moderation" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/users", label: "Users" },
        { href: "/matchups", label: "Back to site" },
      ]}
    >
      <div className="mx-auto max-w-3xl px-5 py-8">
        <AdminNav />
        {children}
      </div>
    </PageShell>
  );
}
