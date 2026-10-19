import KioskApp from "@/components/KioskApp";

export default async function KioskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <KioskApp token={token} />;
}
