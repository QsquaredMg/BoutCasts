import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InstrumentalUpload from "@/components/InstrumentalUpload";
import type { Instrumental } from "@/lib/types";

export const metadata: Metadata = {
  title: "Upload an instrumental | BoutCasts",
  description: "Beat producers: submit an instrumental for rap, singing and dance bouts.",
};

// Any signed-in producer can submit a track; it stays pending until staff approve it.
export default async function UploadInstrumentalPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-5 py-10">
        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Upload an instrumental</h1>
        <p className="mb-4 text-sm" style={{ color: "var(--text-dim)" }}>Sign in to add a beat to the BoutCasts library.</p>
        <Link href="/login?next=/instrumentals/upload" className="font-semibold underline" style={{ color: "var(--red)" }}>
          Sign in
        </Link>
      </div>
    );
  }

  const { data: mine } = await supabase
    .from("instrumentals")
    .select("*")
    .eq("uploaded_by", user.id)
    .order("created_at", { ascending: false });
  const tracks = (mine as Instrumental[] | null) ?? [];

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Upload an instrumental</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Your track is reviewed by BoutCasts staff before it appears in the library. Approved tracks credit you on
        every bout that uses them.
      </p>
      <InstrumentalUpload />
      <p className="mt-8 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
        Want your beat used in battles you run yourself?{" "}
        <Link href="/host" className="font-semibold underline" style={{ color: "var(--red)" }}>
          Become an organizer
        </Link>
        .
      </p>
      {tracks.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Your uploads</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {tracks.map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>{t.title}</span>
                <span className="font-bold uppercase" style={{ color: "var(--text-faint)" }}>{t.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
