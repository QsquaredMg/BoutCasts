import LiveVoteBallot from "@/components/LiveVoteBallot";

export default async function VotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <LiveVoteBallot eventId={id} />
    </div>
  );
}
