import PageShell from "@/components/pagetheme/PageShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      theme="show"
      name="Judged"
      accent="Showcases"
      tagline="One video. A judging panel. The crowd."
      tabs={[
        { href: "/matchups", label: "Browse showcases", match: ["/showcase"] },
        { href: "/showcase/play", label: "How it works" },
        { href: "/debates", label: "Debates" },
      ]}
    >
      {children}
    </PageShell>
  );
}
