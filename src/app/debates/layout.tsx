import PageShell from "@/components/pagetheme/PageShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      theme="deb"
      name="Video"
      accent="Debates"
      tagline="Pick a side. Make your case."
      wide
      tabs={[
        { href: "/debates", label: "All debates", match: ["/debates"] },
        { href: "/debates/play", label: "How it works" },
        { href: "/showcase/play", label: "Panel debates" },
      ]}
    >
      {children}
    </PageShell>
  );
}
