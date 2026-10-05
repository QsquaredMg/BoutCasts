import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log in", description: "Log in to BoutCasts to vote, enter matchups and run live votes for your school, team or event." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
