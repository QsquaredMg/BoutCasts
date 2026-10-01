import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join an event",
  description: "Enter the code from your school, team or event organizer to vote.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
