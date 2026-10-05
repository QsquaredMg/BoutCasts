import type { Metadata } from "next";

export const metadata: Metadata = { title: "Submit a clip", description: "Enter the arena: upload or link your music, dance, rap or debate clip and get matched head-to-head for the crowd to decide." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
