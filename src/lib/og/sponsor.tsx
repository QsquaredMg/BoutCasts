import type { SupabaseClient } from "@supabase/supabase-js";

// Sponsor branding for generated share images (vote graphics, link previews).

export type OgSponsor = { name: string; logo: string | null };

const OK_TYPES = ["image/png", "image/jpeg", "image/gif", "image/svg+xml"];

/** Fetch a logo and inline it, so a slow or unsupported image can't break the render. */
export async function logoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!OK_TYPES.includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1_500_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The bout's own sponsor, falling back to its category's sponsor. */
export async function loadBoutSponsor(
  supabase: SupabaseClient,
  bout: { sponsor_id?: string | null; category_id?: string | null }
): Promise<OgSponsor | null> {
  let sponsorId = bout.sponsor_id ?? null;
  if (!sponsorId && bout.category_id) {
    const { data: cat } = await supabase.from("categories").select("sponsor_id").eq("id", bout.category_id).maybeSingle();
    sponsorId = cat?.sponsor_id ?? null;
  }
  if (!sponsorId) return null;
  const { data: s } = await supabase.from("sponsors").select("name, logo_url").eq("id", sponsorId).maybeSingle();
  if (!s?.name) return null;
  return { name: s.name, logo: await logoDataUrl(s.logo_url) };
}

/** "Presented by" bar for the bottom of a share image. */
export function SponsorBar({ sponsor, scale = 1 }: { sponsor: OgSponsor; scale?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18 * scale,
        background: "#ffffff",
        color: "#0a0e1a",
        borderRadius: 22 * scale,
        padding: `${14 * scale}px ${28 * scale}px`,
      }}
    >
      <div style={{ display: "flex", fontSize: 18 * scale, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#5a6275" }}>
        Presented by
      </div>
      {sponsor.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.logo} width={180 * scale} height={56 * scale} style={{ display: "flex", objectFit: "contain" }} alt="" />
      ) : null}
      <div style={{ display: "flex", fontSize: 30 * scale, fontWeight: 800 }}>{sponsor.name}</div>
    </div>
  );
}
