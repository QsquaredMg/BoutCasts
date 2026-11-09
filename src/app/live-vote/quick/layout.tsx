import type { Metadata } from "next";

export const metadata: Metadata = { title: "Quick Vote for the big screen", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
