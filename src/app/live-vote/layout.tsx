import type { Metadata } from "next";

export const metadata: Metadata = { title: "Live Vote", description: "Run a live vote for class elections, halftime polls, talent shows and awards — one vote per person, results in real time. Free to start." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
