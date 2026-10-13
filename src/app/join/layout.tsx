import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join",
  description: "Enter your code or paste the link from your school, team or event organizer.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
