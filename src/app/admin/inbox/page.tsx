import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { bareAddress, displayName, type InboxMessage } from "@/lib/inbox";
import InboxThreadActions from "@/components/admin/InboxThreadActions";
import InboxCompose from "@/components/admin/InboxCompose";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminInboxPage({ searchParams }: { searchParams: Promise<{ t?: string; f?: string }> }) {
  const { t, f } = await searchParams;
  const filter = f === "done" ? "done" : f === "all" ? "all" : "open";

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    return <Notice>The inbox needs the server key (SUPABASE_SERVICE_ROLE_KEY) set in Vercel.</Notice>;
  }

  // ---- One conversation ----
  if (t) {
    const [{ data: msgs, error }, { data: th }] = await Promise.all([
      db.from("inbox_messages").select("*").eq("thread_id", t).order("received_at"),
      db.from("inbox_threads").select("status").eq("thread_id", t).maybeSingle(),
    ]);
    if (error) return <Notice>Could not load this conversation. Has docs/sql/inbox.sql been run?</Notice>;
    const list = (msgs ?? []) as InboxMessage[];
    if (list.length === 0) {
      return (
        <Notice>
          Conversation not found. <Link href="/admin/inbox" className="underline">Back to the inbox</Link>
        </Notice>
      );
    }
    const subject = list[0].subject || "(no subject)";
    const unread = list.some((m) => m.direction === "in" && !m.read_at);
    return (
      <div>
        <Link href="/admin/inbox" className="mb-3 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
          &larr; Inbox
        </Link>
        <h2 className="mb-4 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{subject}</h2>
        <ol className="flex flex-col gap-3">
          {list.map((m) => (
            <li key={m.id} className="bc-card p-4" style={m.direction === "out" ? { background: "var(--surface-2)" } : undefined}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
                <span className="font-bold" style={{ color: "var(--text)" }}>{m.direction === "out" ? `You (${bareAddress(m.from_addr)})` : displayName(m.from_addr)}</span>
                <span>{when(m.received_at)}</span>
              </div>
              {m.direction === "in" && m.from_addr && (
                <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
                  {m.from_addr}
                  {m.authentication && (m.authentication.dkim === "fail" || m.authentication.spf === "fail") ? " · ⚠️ sender could not be verified" : ""}
                </p>
              )}
              {m.text_body ? (
                <p className="whitespace-pre-wrap break-words text-sm">{m.text_body}</p>
              ) : m.html_body ? (
                // Untrusted HTML: sandboxed with no permissions, so no scripts and no navigation.
                <iframe title="Email" sandbox="" srcDoc={m.html_body} className="h-72 w-full rounded-lg border bg-white" style={{ borderColor: "var(--border)" }} />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>(empty message)</p>
              )}
              {m.attachments?.length > 0 && (
                <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
                  📎 {m.attachments.map((a) => a.filename ?? "attachment").join(", ")} (open these in the Resend dashboard)
                </p>
              )}
            </li>
          ))}
        </ol>
        <InboxThreadActions threadId={t} status={th?.status === "done" ? "done" : "open"} unread={unread} />
      </div>
    );
  }

  // ---- Conversation list ----
  const [{ data: rows, error }, { data: states }] = await Promise.all([
    db.from("inbox_messages").select("id, thread_id, direction, from_addr, subject, text_body, received_at, read_at").order("received_at", { ascending: false }).limit(500),
    db.from("inbox_threads").select("thread_id, status"),
  ]);
  if (error) return <Notice>Could not load the inbox. Has docs/sql/inbox.sql been run?</Notice>;

  const status = new Map((states ?? []).map((s) => [s.thread_id, s.status as "open" | "done"]));
  type Row = NonNullable<typeof rows>[number];
  const threads = new Map<string, { latest: Row; first: Row; unread: number; count: number }>();
  for (const r of rows ?? []) {
    const cur = threads.get(r.thread_id);
    if (!cur) threads.set(r.thread_id, { latest: r, first: r, unread: r.direction === "in" && !r.read_at ? 1 : 0, count: 1 });
    else {
      cur.count++;
      cur.first = r;
      if (r.direction === "in" && !r.read_at) cur.unread++;
    }
  }
  const items = [...threads.entries()].filter(([id]) => filter === "all" || (status.get(id) ?? "open") === filter);

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Inbox</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>Mail sent to the BoutCasts support address. Send replies or new email from support@ or info@.</p>
      <InboxCompose />
      <div className="mb-4 flex gap-2">
        {(["open", "done", "all"] as const).map((k) => (
          <Link key={k} href={k === "open" ? "/admin/inbox" : `/admin/inbox?f=${k}`} className="rounded-full px-4 py-1.5 text-sm font-bold capitalize" style={filter === k ? { background: "var(--blue)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-dim)" }}>
            {k}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="bc-card p-4 text-sm" style={{ color: "var(--text-faint)" }}>
          {filter === "open" ? "Nothing waiting. New mail shows up here as it arrives." : "No conversations here."}
        </p>
      ) : (
        <ul className="bc-card divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {items.map(([id, th]) => (
            <li key={id} style={{ borderColor: "var(--border)" }}>
              <Link href={`/admin/inbox?t=${encodeURIComponent(id)}`} className="flex items-start gap-3 px-4 py-3 hover:opacity-80">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: th.unread ? "var(--red)" : "transparent" }} aria-label={th.unread ? "Unread" : undefined} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${th.unread ? "font-bold" : "font-semibold"}`}>
                      {th.latest.direction === "out" ? "You" : displayName(th.latest.from_addr)}
                      {th.count > 1 ? ` (${th.count})` : ""}
                    </span>
                    <span className="shrink-0 text-xs" style={{ color: "var(--text-faint)" }}>{when(th.latest.received_at)}</span>
                  </span>
                  <span className="block truncate text-sm">{th.first.subject || "(no subject)"}</span>
                  <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>{(th.latest.text_body ?? "").replace(/\s+/g, " ").slice(0, 120)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="bc-card p-4 text-sm" style={{ color: "var(--text-dim)" }}>{children}</p>;
}
