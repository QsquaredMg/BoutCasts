import PageShell from "@/components/pagetheme/PageShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      theme="spons"
      name="Sponsor"
      accent="BoutCasts"
      tagline="Be seen where fans cheer."
      tabs={[
        { href: "/sponsor", label: "Become a sponsor", match: ["/sponsor$"] },
        { href: "/sponsor/creatives", label: "My ads", match: ["/sponsor/creatives"] },
        { href: "/sponsor/play", label: "What sponsors get" },
      ]}
    >
      {children}
    </PageShell>
  );
}
