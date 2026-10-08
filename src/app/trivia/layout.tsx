import PageShell from "@/components/pagetheme/PageShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell
      theme="main"
      name="Live"
      accent="Trivia"
      tagline="Phones in, scores on the big screen."
      tabs={[
        { href: "/trivia", label: "Join a game", match: ["/trivia$"] },
        { href: "/trivia/packs", label: "Question packs", match: ["/trivia/packs"] },
        { href: "/host", label: "Host a vote" },
      ]}
    >
      {children}
    </PageShell>
  );
}
