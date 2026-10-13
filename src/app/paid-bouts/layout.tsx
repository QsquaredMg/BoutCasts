import PageShell from "@/components/pagetheme/PageShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      theme="paid"
      name="Paid"
      accent="Bouts"
      tagline="Rules and payouts posted before you pay."
      tabs={[
        { href: "/paid-bouts", label: "Open bouts", match: ["/paid-bouts"] },
        { href: "/paid-bouts/play", label: "How it works" },
        { href: "/competitions/play", label: "Free competitions" },
      ]}
    >
      {children}
    </PageShell>
  );
}
