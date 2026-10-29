import { notFound } from "next/navigation";
import SchoolElectionForm from "@/components/SchoolElectionForm";
import { UUID } from "@/lib/schoolElection";

export default async function EditSchoolElectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <SchoolElectionForm editId={id} />;
}
