import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { robots: { index: false, follow: false } };

export default async function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z]{6}$/.test(clean)) notFound();
  const supabase = await createClient();
  const { data: id } = await supabase.rpc("pred_slate_by_code", { p_code: clean });
  if (!id) notFound();
  redirect(`/predictions/slate/${id}`);
}
