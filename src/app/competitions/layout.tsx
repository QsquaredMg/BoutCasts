import type { Metadata } from "next";
import PageShell from "@/components/pagetheme/PageShell";

export const metadata: Metadata = { title: "Competitions", description: "Run your own bracket: band battles, dance-offs, rap and talent competitions where the crowd votes each round." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      theme="comp"
      name="Bracket"
      accent="Competitions"
      tagline="You approve the entries. The crowd picks the champion."
      tabs={[
        { href: "/competitions", label: "My competitions", match: ["/competitions"] },
        { href: "/competitions/play", label: "How it works" },
        { href: "/matchups", label: "Live matchups" },
      ]}
    >
      {children}
    </PageShell>
  );
}
