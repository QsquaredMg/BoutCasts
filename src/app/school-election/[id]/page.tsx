import SchoolElectionManager from "@/components/SchoolElectionManager";

export default async function SchoolElectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <SchoolElectionManager id={id} checkout={checkout ?? null} />
    </div>
  );
}
