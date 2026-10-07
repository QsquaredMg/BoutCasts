import { cardMetadata } from "@/lib/og/cardRoute";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShowcaseView from "@/components/showcases/ShowcaseView";
import type { Showcase, ShowcaseChoice } from "@/lib/showcases";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("showcases").select("title, kind").eq("id", id).maybeSingle();
  return cardMetadata("showcase", id, data ? data.title : "Showcase");
}

export default async function ShowcasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase.from("showcases").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: choices }, { data: userData }] = await Promise.all([
    supabase.from("showcase_choices").select("*").eq("showcase_id", id).order("sort_order"),
    supabase.auth.getUser(),
  ]);
  let isAdmin = false;
  let judges: { id: string; name: string; token: string }[] = [];
  if (userData.user) {
    const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
    isAdmin = Boolean(p?.is_admin);
    if (isAdmin) {
      const { data: j } = await supabase.from("showcase_judges").select("id, name, token").eq("showcase_id", id).order("created_at");
      judges = j ?? [];
    }
  }
  return <ShowcaseView showcase={s as Showcase} choices={(choices ?? []) as ShowcaseChoice[]} isAdmin={isAdmin} judges={judges} />;
}
