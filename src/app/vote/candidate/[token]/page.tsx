import type { Metadata } from "next";
import CandidateMediaForm from "@/components/CandidateMediaForm";

export const metadata: Metadata = {
  title: "Add your photo & speech",
  robots: { index: false, follow: false },
};

export default async function CandidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <CandidateMediaForm token={token} />
    </div>
  );
}
