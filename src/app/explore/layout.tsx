import MainShell from "@/components/pagetheme/MainShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MainShell tagline="Votes, polls and shows happening now.">{children}</MainShell>;
}
