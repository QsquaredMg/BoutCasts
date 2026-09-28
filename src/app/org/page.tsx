import type { Metadata } from "next";
import OrgLicense from "@/components/OrgLicense";

export const metadata: Metadata = {
  title: "School & League License",
  description: "One annual license for your whole school, district or league: staff accounts, unlimited Live Votes, Pro analytics and white-label on every event.",
};

export default function OrgPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <OrgLicense />
    </div>
  );
}
