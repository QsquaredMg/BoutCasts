"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ReportLink = {
  id: string; token: string; sponsor_id: string; sponsor_name: string; label: string | null;
  range_days: number | null; expires_at: string | null; revoked_at: string | null;
  view_count: number; last_viewed_at: string | null; created_at: string; expired: boolean;
};

const RANGES = [
  { v: "30", label: "Last 30 days" },
  { v: "90", label: "Last 90 days" },
  { v: "", label: "All time" },
];

export default function ReportLinkManager({
  sponsors, links, preselect,
}: { sponsors: { id: string; name: string }[]; links: ReportLink[]; preselect?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [sponsorId, setSponsorId] = useState(preselect && sponsors.some((s) => s.id === preselect) ? preselect : sponsors[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [range, setRange] = useState("30");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function create() {
    if (!sponsorId) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("analytics_report_links").insert({
      sponsor_id: sponsorId,
      label: label.trim() || null,
      range_days: range ? Number(range) : null,
      expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      setLabel("");
      setExpires("");
      router.refresh();
    }
  }

  async function setRevoked(id: string, revoked: boolean) {
    const { error } = await supabase
      .from("analytics_report_links")
      .update({ revoked_at: revoked ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) setMsg(error.message);
    else router.refresh();
  }

  async function copy(l: ReportLink) {
    const url = `${window.location.origin}/report/${l.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(l.id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "never");
  const input = "rounded-lg border px-3 py-2 text-sm";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

  return (
    <div>
      <div className="bc-card mb-5 p-4">
        <h4 className="mb-2 text-sm font-bold">New advertiser report link</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Advertiser
            <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className={`${input} mt-1 w-full`} style={inputStyle}>
              {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Label (only you see this)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Fall campaign" className={`${input} mt-1 w-full`} style={inputStyle} />
          </label>
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Data window
            <select value={range} onChange={(e) => setRange(e.target.value)} className={`${input} mt-1 w-full`} style={inputStyle}>
              {RANGES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Link expires (optional)
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={`${input} mt-1 w-full`} style={inputStyle} />
          </label>
        </div>
        <button type="button" onClick={create} disabled={busy || !sponsorId} className="bc-btn-solid mt-3 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-50">
          {busy ? "Creating…" : "Create link"}
        </button>
        {msg && <p role="alert" className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{msg}</p>}
        <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
          Anyone with the link can see that advertiser&apos;s numbers, nothing else. The window is always the most recent N days up to today.
        </p>
      </div>

      {links.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>No report links yet.</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {links.map((l) => {
            const state = l.revoked_at ? "Revoked" : l.expired ? "Expired" : "Active";
            return (
              <li key={l.id} className="bc-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{l.sponsor_name}{l.label ? ` · ${l.label}` : ""}</div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {state} · {l.range_days ? `last ${l.range_days} days` : "all time"}
                      {l.expires_at ? ` · expires ${fmt(l.expires_at)}` : ""}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                      Opened {l.view_count} time{l.view_count === 1 ? "" : "s"} · last {fmt(l.last_viewed_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => copy(l)} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>
                      {copied === l.id ? "Copied" : "Copy link"}
                    </button>
                    <a href={`/report/${l.token}`} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Preview</a>
                    <a href={`/report/${l.token}/pdf`} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)" }}>PDF</a>
                    <button type="button" onClick={() => setRevoked(l.id, !l.revoked_at)} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)", color: l.revoked_at ? "var(--text)" : "var(--danger)" }}>
                      {l.revoked_at ? "Restore" : "Revoke"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
