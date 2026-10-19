import { getElectionBrand } from "@/lib/schoolElection";
import { roomThemeVars } from "@/lib/liveVoteEvents/roomTheme";

// Wraps an election page in the school's colors, banner and logo chosen at setup.
export default async function ElectionBrandFrame({ id, children }: { id: string; children: React.ReactNode }) {
  const b = await getElectionBrand(id);
  const style = roomThemeVars(b?.brand_color ?? null, b?.brand_bg_color ?? null, b?.brand_bg_image_url ?? null) as React.CSSProperties;
  return (
    <div data-brand-room="" data-white-label="" className="min-h-screen" style={style}>
      {b?.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.cover_image_url} alt="" className="h-32 w-full object-cover sm:h-44" />
      )}
      {(b?.brand_logo_url || b?.school_name) && (
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 pt-5">
          {b.brand_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.brand_logo_url} alt={b.school_name ? `${b.school_name} logo` : "School logo"} className="h-14 w-14 rounded-xl object-contain" />
          )}
          {b.school_name && <p className="text-lg font-extrabold">{b.school_name}</p>}
        </div>
      )}
      {children}
      <p className="pb-6 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
        Powered by <a href="https://www.boutcasts.com" className="font-semibold underline">BoutCasts</a>
      </p>
    </div>
  );
}
