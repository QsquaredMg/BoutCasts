import PageShell from "./PageShell";

// The BoutCasts main-site header band (red, blue and gold), shared by the browse pages.
export default function MainShell({ tagline, children, bandWidth }: { tagline: string; children: React.ReactNode; bandWidth?: string }) {
  return (
    <PageShell
      theme="main"
      name="Bout"
      accent="Casts"
      tagline={tagline}
      bandWidth={bandWidth}
      tabs={[
        { href: "/discover", label: "Discover" },
        { href: "/debates", label: "Debates" },
        { href: "/competitions", label: "Competitions" },
        { href: "/host", label: "Host a vote" },
      ]}
    >
      {children}
    </PageShell>
  );
}
