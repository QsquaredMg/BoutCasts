import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Errors" };

type Row = { id: number; created_at: string; source: string; message: string; digest: string | null; path: string | null; user_agent: string | null };

function device(ua: string | null) {
  if (!ua) return "";
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "";
}

export default async function AdminErrorsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("app_errors").select("*").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as Row[];
  // Server component: rendered fresh on every request, so "now" is fine here.
  // eslint-disable-next-line react-hooks/purity
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const last24 = rows.filter((r) => new Date(r.created_at).getTime() > dayAgo).length;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Errors
      </h1>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
        Anything that breaks on the site shows up here, newest first. Admins with notifications on get a phone alert (at most one every 15 minutes).{" "}
        <strong>{last24}</strong> in the last 24 hours.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>No errors recorded. 🎉</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-faint)" }}>
                <span>{new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</span>
                <span className="rounded-full border px-2 py-0.5 font-bold uppercase" style={{ borderColor: "var(--border)" }}>
                  {r.source === "server" ? "Server" : "Browser"}
                </span>
                {device(r.user_agent) && <span>{device(r.user_agent)}</span>}
              </div>
              <p className="break-words font-semibold">{r.message}</p>
              {r.path && <p className="break-all text-xs" style={{ color: "var(--text-dim)" }}>{r.path}</p>}
              {r.digest && <p className="text-xs" style={{ color: "var(--text-faint)" }}>Ref {r.digest}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
