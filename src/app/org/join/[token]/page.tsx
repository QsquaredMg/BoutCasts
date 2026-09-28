import type { Metadata } from "next";
import OrgJoin from "@/components/OrgJoin";

export const metadata: Metadata = { title: "Join your team on BoutCasts", robots: { index: false } };

export default async function OrgJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <OrgJoin token={token} />
    </div>
  );
}
