import { createClient } from "@/lib/supabase/server";
import AdManager from "@/components/AdManager";

export default async function AdminAdsPage() {
  const supabase = await createClient();

  const [{ data: sponsors }, { data: ads }] = await Promise.all([
    supabase.from("sponsors").select("id, name").order("name"),
    supabase.from("ad_creatives").select("*").order("created_at", { ascending: false }),
  ]);

  const adIds = (ads ?? []).map((a) => a.id);
  const { data: events } =
    adIds.length > 0
      ? await supabase.from("ad_events").select("ad_id, event_type").in("ad_id", adIds)
      : { data: [] as { ad_id: string; event_type: string }[] };

  const statsByAd = new Map<string, { impressions: number; clicks: number }>();
  for (const e of events ?? []) {
    const s = statsByAd.get(e.ad_id) ?? { impressions: 0, clicks: 0 };
    if (e.event_type === "impression") s.impressions++;
    else if (e.event_type === "click") s.clicks++;
    statsByAd.set(e.ad_id, s);
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Ads
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Upload sponsor ad creative, control where and when it fires, and see how it's performing.
      </p>
      <AdManager
        sponsors={sponsors ?? []}
        initialAds={ads ?? []}
        statsByAd={Object.fromEntries(statsByAd)}
      />
    </div>
  );
}
