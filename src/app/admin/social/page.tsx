import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SocialQueue, { type QueueRow } from "@/components/admin/SocialQueue";
import { socialConfigured } from "@/lib/social/publish";

export const metadata: Metadata = { title: "Social posts" };
export const dynamic = "force-dynamic";

export default async function AdminSocialPage() {
  const supabase = await createClient();
  const [{ data: posts }, { data: settings }] = await Promise.all([
    supabase.from("social_posts").select("id, kind, title, winner, status, caption_facebook, caption_instagram, error, results, created_at").order("created_at", { ascending: false }).limit(60),
    supabase.from("social_settings").select("mode, hashtags").eq("id", 1).maybeSingle(),
  ]);
  const cfg = socialConfigured();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Social posts</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--text-dim)" }}>
        Finished bouts, brackets, live votes, prediction slates and trivia games show up here with a result card and a top-10 caption.
        Approve one to post it to the BoutCasts Facebook Page and Instagram.
      </p>
      <SocialQueue
        initial={(posts ?? []) as QueueRow[]}
        mode={(settings?.mode ?? "approve") as "off" | "approve" | "auto"}
        facebookReady={cfg.facebook}
        instagramReady={cfg.instagram}
      />
    </div>
  );
}
