"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

export default function SubmitPage() {
  const supabase = createClient();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [entryType, setEntryType] = useState<"free" | "paid">("free");
  const [sourceType, setSourceType] = useState<"upload" | "link" | "record">("link");
  const [sourceUrl, setSourceUrl] = useState("");

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
      // Clean the query string so a page refresh doesn't re-show the banner.
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

    if (entryType === "paid") {
      // Paid entries are never inserted directly by the client. We send the
      // draft to Stripe Checkout; the submission row is created server-side
      // by the webhook only after payment actually succeeds.
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            categoryId,
            sourceType,
            sourceUrl: sourceType === "link" ? sourceUrl : null,
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
      source_url: sourceType === "link" ? sourceUrl : null,
      entry_type: "free",
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

  if (signedIn === false) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12">
        <h1 className="mb-4 text-2xl font-bold">Submit an entry</h1>
        <p className="text-neutral-600">
          You need to{" "}
          <a href="/login" className="font-medium text-red-600 underline">
            sign in
          </a>{" "}
          to submit an entry.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Submit an entry</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="mb-1 block text-sm font-semibold">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2"
            placeholder="e.g. Freestyle 60 — Iron Mic Series"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Entry type</label>
          <div className="flex gap-4">
            {(["free", "paid"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="entryType"
                  checked={entryType === t}
                  onChange={() => setEntryType(t)}
                />
                {t === "free" ? "Free entry" : "Paid entry"}
              </label>
            ))}
          </div>
          {entryType === "paid" && (
            <p className="mt-2 rounded bg-amber-50 p-3 text-xs text-amber-800">
              Paid entries cost $5.00, charged via Stripe Checkout &mdash; you&apos;ll
              be redirected to a secure payment page before your submission is
              recorded. If a paid entry is later rejected, the fee is credited to
              your wallet as BoutBucks rather than a cash refund.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Source</label>
          <div className="mb-2 flex gap-4">
            {(["upload", "link", "record"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm capitalize">
                <input
                  type="radio"
                  name="sourceType"
                  checked={sourceType === t}
                  onChange={() => setSourceType(t)}
                />
                {t}
              </label>
            ))}
          </div>

          {sourceType === "link" && (
            <input
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded border border-neutral-300 px-3 py-2"
            />
          )}

          {(sourceType === "upload" || sourceType === "record") && (
            <p className="rounded bg-neutral-100 p-3 text-sm text-neutral-500">
              {sourceType === "upload" ? "File upload" : "In-browser recording"} is
              coming soon — this submission will be saved with no media attached
              yet.
            </p>
          )}
        </div>

        {paidStatus === "success" && (
          <p className="text-sm text-green-700">
            Payment received! Your paid entry is being recorded and will show up
            shortly, pending review.
          </p>
        )}
        {paidStatus === "cancelled" && (
          <p className="text-sm text-amber-700">
            Checkout was cancelled — no charge was made. You can try again below.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-sm text-green-700">Submission received — pending review.</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-red-600 py-2 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit entry"}
        </button>
      </form>
    </div>
  );
}
