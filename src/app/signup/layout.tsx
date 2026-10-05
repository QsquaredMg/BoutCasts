import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign up", description: "Create a free BoutCasts account to vote on band battles, dance-offs and debates, or host a live vote." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
