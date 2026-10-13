import MainShell from "@/components/pagetheme/MainShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MainShell bandWidth="45rem" tagline="Your votes, picks and notifications.">
      {children}
    </MainShell>
  );
}
