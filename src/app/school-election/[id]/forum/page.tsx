import { notFound } from "next/navigation";
import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import ElectionForumAsk from "@/components/ElectionForumAsk";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, type ElectionRow } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Public forum page: ask the candidates a question, and read the ones teachers approved. No vote counts here.
export default async function ForumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = createAdminClient();
  const { data } = await admin.from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = data as ElectionRow | null;
  if (!election || !election.forum_enabled) notFound();
  const { data: qs } = await admin
    .from("election_forum_questions")
    .select("id, body, asker, status")
    .eq("election_id", id)
    .in("status", ["approved", "asked"])
    .order("created_at", { ascending: true })
    .limit(200);
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-2xl px-5 py-8">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{election.school_name ?? "School election"}</p>
        <h1 className="text-3xl font-extrabold">Ask the candidates</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>{election.title}. A good question can be answered with facts, and it is about the job, not about a person. A teacher reads every question before it is posted.</p>
        {election.status !== "closed" && <ElectionForumAsk id={id} />}
        <h2 className="mt-8 text-xl font-extrabold">Approved questions</h2>
        <ul className="mt-3 grid gap-3">
          {(qs ?? []).map((q) => (
            <li key={q.id} className="rounded-xl border p-4" style={box}>
              <p className="font-semibold">{q.body}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                {q.asker ? `Asked by ${q.asker}` : "Asked by a student"}{q.status === "asked" ? " · Asked at the debate" : ""}
              </p>
            </li>
          ))}
          {(qs ?? []).length === 0 && <li className="text-sm" style={{ color: "var(--text-dim)" }}>No questions are posted yet.</li>}
        </ul>
      </div>
    </ElectionBrandFrame>
  );
}
