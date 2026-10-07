import MainShell from "@/components/pagetheme/MainShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MainShell bandWidth="56rem" tagline="Every battle live right now. Pick a side.">{children}</MainShell>;
}
