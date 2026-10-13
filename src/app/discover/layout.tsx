import MainShell from "@/components/pagetheme/MainShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MainShell bandWidth="1100px" tagline="Find something to vote on.">{children}</MainShell>;
}
