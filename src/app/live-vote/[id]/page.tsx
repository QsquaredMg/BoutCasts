import LiveVoteEventManager from "@/components/LiveVoteEventManager";

export default async function LiveVoteEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <LiveVoteEventManager eventId={id} checkoutStatus={checkout ?? null} />
    </div>
  );
}
