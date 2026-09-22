import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FeaturedBout from "@/components/FeaturedBout";

export default async function BoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bout } = await supabase.from("bouts").select("id").eq("id", id).maybeSingle();
  if (!bout) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <FeaturedBout boutId={id} showBackLink />
    </div>
  );
}
