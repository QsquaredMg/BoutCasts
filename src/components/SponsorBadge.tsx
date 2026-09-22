import PrizeTag from "@/components/PrizeTag";

type SponsorLike = {
  name: string;
  logo_url?: string | null;
  opportunity_type?: string | null;
  banner_style?: string | null;
};

const OPP_LABEL: Record<string, { icon: string; label: string }> = {
  commercial: { icon: "📺", label: "Commercial Partner" },
  bracket: { icon: "🏆", label: "Bracket Sponsor" },
  bout: { icon: "🥊", label: "Bout Sponsor" },
  curated: { icon: "🎨", label: "Curated by" },
};

// Renders a sponsor's credit line consistently everywhere it appears —
// matchups feed, bout page — with the sponsor's logo when one is set and a
// distinct label per opportunity type, instead of one generic
// "Presented by" string for every kind of sponsorship.
export default function SponsorBadge({ sponsor }: { sponsor: SponsorLike }) {
  const opp = sponsor.opportunity_type || undefined;

  if (opp === "prizes" && sponsor.banner_style) {
    return (
      <span className="inline-flex items-center gap-2">
        {sponsor.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sponsor.logo_url} alt={sponsor.name} className="h-5 w-5 rounded object-contain" />
        )}
        <PrizeTag style={sponsor.banner_style} brand={sponsor.name} />
      </span>
    );
  }

  const info = opp ? OPP_LABEL[opp] : undefined;

  return (
    <span className="inline-flex items-center gap-1.5">
      {sponsor.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.logo_url} alt={sponsor.name} className="h-4 w-4 rounded-sm object-contain" />
      ) : info ? (
        <span>{info.icon}</span>
      ) : null}
      {info ? (
        <>
          {info.label} {sponsor.name}
        </>
      ) : (
        <>Presented by {sponsor.name}</>
      )}
    </span>
  );
}
