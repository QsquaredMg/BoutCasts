"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";
import InAppRecorder from "@/components/InAppRecorder";

export default function SubmitPage() {
  const supabase = createClient();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [entryType, setEntryType] = useState<"free" | "paid">("free");
  const [sourceType, setSourceType] = useState<"link" | "record">("link");
  const [sourceUrl, setSourceUrl] = useState("");
  const [recordedClipUrl, setRecordedClipUrl] = useState<string | null>(null);
  const [isCrew, setIsCrew] = useState(false);
  const [crewName, setCrewName] = useState("");
  const [teammates, setTeammates] = useState<string[]>([""]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paidStatus, setPaidStatus] = useState<"success" | "cancelled" | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      setSignedIn(!!userData.user);

      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      setCategories(cats ?? []);
      if (cats && cats.length > 0) setCategoryId(cats[0].id);
    }
    load();

    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    if (paid === "success" || paid === "cancelled") {
      setPaidStatus(paid);
      window.history.replaceState({}, "", "/submit");
    }
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      router.push("/login");
      return;
    }

    if (sourceType === "link" && !sourceUrl) {
      setError("Please provide a URL for a link submission.");
      setLoading(false);
      return;
    }

    if (sourceType === "record" && !recordedClipUrl) {
      setError("Record a clip before submitting.");
      setLoading(false);
      return;
    }

    if (entryType === "paid") {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            categoryId,
            sourceType,
            sourceUrl: sourceType === "link" ? sourceUrl : sourceType === "record" ? recordedClipUrl : null,
            crewName: isCrew ? crewName : null,
            teammates: isCrew ? teammates.filter((t) => t.trim()) : null,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error ?? "Failed to start checkout");
        }
        window.location.href = data.url;
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Failed to start checkout");
      }
      return;
    }

    const { error } = await supabase.from("submissions").insert({
      user_id: user.id,
      category_id: categoryId,
      title,
      source_type: sourceType,
      source_url: sourceType === "link" ? sourceUrl : sourceType === "record" ? recordedClipUrl : null,
      entry_type: "free",
      crew_name: isCrew ? crewName || null : null,
      teammates: isCrew ? teammates.filter((t) => t.trim()) : null,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTitle("");
    setSourceUrl("");
  }

  const inputClass = "w-full rounded-[10px] border px-3.5 py-2.5 text-sm";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };
  const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide";
  const labelStyle = { color: "var(--text-dim)" };

  if (signedIn === false) {
    return (
      <div className="mx-auto max-w-sm px-5 py-12">
        <h1 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Submit an entry
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          You need to{" "}
          <a href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
            sign in
          </a>{" "}
          to submit an entry.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Submit a Bout
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className={labelClass} style={labelStyle}>Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="e.g. Freestyle 60 — Iron Mic Series"
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>Entry type</label>
          <div className="grid grid-cols-2 gap-2.5">
            {(["free", "paid"] as const).map((t) => {
              const active = entryType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEntryType(t)}
                  className="rounded-xl border p-3.5 text-left"
                  style={{
                    borderColor: active ? "var(--blue)" : "var(--border)",
                    background: active ? "var(--blue-soft)" : "var(--surface)",
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span
                      className="h-3.5 w-3.5 rounded-full border-2"
                      style={{
                        borderColor: active ? "var(--blue)" : "var(--border)",
                        background: active ? "var(--blue)" : "transparent",
                      }}
                    />
                    {t === "free" ? "Free entry" : "Paid entry ($5.00)"}
                  </div>
                </button>
              );
            })}
          </div>
          {entryType === "paid" && (
            <p className="mt-2 rounded-xl p-3 text-xs" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
              Paid entries cost $5.00, charged via Stripe Checkout &mdash; you&apos;ll
              be redirected to a secure payment page before your submission is
              recorded. If a paid entry is later rejected, the fee is credited to
              your wallet as BoutBucks rather than a cash refund.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>Source</label>
          <div
            className="mb-3 inline-flex gap-1 rounded-full p-1"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {(["link", "record"] as const).map((t) => {
              const active = sourceType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSourceType(t)}
                  className="rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize"
                  style={{
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-dim)",
                    boxShadow: active ? "inset 0 0 0 1px var(--border)" : "none",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {sourceType === "link" && (
            <input
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
              style={inputStyle}
            />
          )}

          {sourceType === "record" && (
            <InAppRecorder onRecorded={setRecordedClipUrl} />
          )}

        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-dim)" }}>
            <input
              type="checkbox"
              checked={isCrew}
              onChange={(e) => setIsCrew(e.target.checked)}
            />
            This is a crew/team entry
          </label>
          {isCrew && (
            <div className="mt-3 flex flex-col gap-2.5">
              <input
                type="text"
                value={crewName}
                onChange={(e) => setCrewName(e.target.value)}
                placeholder="Crew name"
                className={inputClass}
                style={inputStyle}
              />
              {teammates.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={t}
                    onChange={(e) =>
                      setTeammates((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    placeholder="Teammate handle"
                    className={inputClass}
                    style={inputStyle}
                  />
                  {teammates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTeammates((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex-shrink-0 rounded-[10px] border px-3 text-sm"
                      style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTeammates((prev) => [...prev, ""])}
                className="self-start text-xs font-semibold"
                style={{ color: "var(--blue)" }}
              >
                + Add teammate
              </button>
            </div>
          )}
        </div>

        {paidStatus === "success" && (
          <p className="text-sm font-medium" style={{ color: "var(--blue)" }}>
            Payment received! Your paid entry is being recorded and will show up
            shortly, pending review.
          </p>
        )}
        {paidStatus === "cancelled" && (
          <p className="text-sm font-medium" style={{ color: "var(--gold)" }}>
            Checkout was cancelled — no charge was made. You can try again below.
          </p>
        )}
        {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
        {success && (
          <p className="text-sm font-medium" style={{ color: "var(--blue)" }}>
            Submission received — pending review.
          </p>
        )}

        <button type="submit" disabled={loading} className="bc-btn-red py-2.5 disabled:opacity-60">
          {loading ? "Submitting..." : "Submit entry"}
        </button>
      </form>
    </div>
  );
}
