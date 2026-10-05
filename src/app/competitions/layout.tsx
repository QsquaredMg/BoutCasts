import type { Metadata } from "next";

export const metadata: Metadata = { title: "Competitions", description: "Run your own bracket: band battles, dance-offs, rap and talent competitions where the crowd votes each round." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
