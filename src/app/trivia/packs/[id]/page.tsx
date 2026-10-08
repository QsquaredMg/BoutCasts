import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PackEditor from "@/components/trivia/PackEditor";

export const metadata: Metadata = { title: "Edit question pack", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user)
    return <div className="mx-auto max-w-2xl px-5 py-10"><Link href={`/login?next=/trivia/packs/${id}`} className="font-semibold underline">Sign in</Link> to edit this pack.</div>;
  return <PackEditor packId={id} />;
}
