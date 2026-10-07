import MainShell from "@/components/pagetheme/MainShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MainShell tagline="Points, streaks and bouts.">{children}</MainShell>;
}
