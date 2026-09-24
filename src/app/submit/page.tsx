"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Subcategory } from "@/lib/types";
import ClipSourcePicker, { type ClipSourceValue } from "@/components/ClipSourcePicker";

export default function SubmitPage() {
  const supabase = createClient();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [clip, setClip] = useState<ClipSourceValue>({ sourceType: "link", sourceUrl: "" });
  const [isCrew, setIsCrew] = useState(false);
  const [crewName, setCrewName] = useState("");
  const [teammates, setTeammates] = useState<string[]>([""]);
  const [optOut, setOptOut] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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

      const { data: subcats } = await supabase
        .from("subcategories")
        .select("*")
        .order("sort_order");
      setSubcategories(subcats ?? []);
    }
    load();
  }, [supabase]);

  const availableSubcategories = subcategories.filter((s) => s.category_id === categoryId);

  // Keep the selected subcategory valid whenever the category changes (or
  // the subcategory list loads) — clear it if it no longer applies.
  useEffect(() => {
    if (subcategoryId && !availableSubcategories.some((s) => s.id === subcategoryId)) {
      setSubcategoryId("");
    }
  }, [categoryId, availableSubcategories, subcategoryId]);

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

    if (availableSubcategories.length > 0 && !subcategoryId) {
      setError("Please pick a subcategory so we can match you fairly.");
      setLoading(false);
      return;
    }

    if (clip.sourceType === "link" && !clip.sourceUrl) {
      setError("Please provide a URL for a link submission.");
      setLoading(false);
      return;
    }

    if (clip.sourceType === "record" && !clip.sourceUrl) {
      setError("Record a clip before submitting.");
      setLoading(false);
      return;
    }

    if (clip.sourceType === "upload" && !clip.sourceUrl) {
      setError("Upload a file before submitting.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("submissions").insert({
      user_id: user.id,
      category_id: categoryId,
      subcategory_id: subcategoryId || null,
      title,
      source_type: clip.sourceType,
      source_url: clip.sourceUrl,
      crew_name: isCrew ? crewName || null : null,
      teammates: isCrew ? teammates.filter((t) => t.trim()) : null,
      auto_bracket_opt_out: optOut,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTitle("");
    setClip({ sourceType: "link", sourceUrl: "" });
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
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Submit a clip in your category and we&apos;ll automatically match you
        against another approved entry &mdash; your bout goes live and runs for
        42 hours of voting once it&apos;s matched.
      </p>

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

        {availableSubcategories.length > 0 && (
          <div>
            <label className={labelClass} style={labelStyle}>Subcategory</label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="" disabled>
                Select subcategory
              </option>
              {availableSubcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
              We only match you against entries in the same subcategory, so it&apos;s a fair fight.
            </p>
          </div>
        )}

        <div>
          <label className={labelClass} style={labelStyle}>Clip</label>
          <ClipSourcePicker value={clip} onChange={setClip} inputClass={inputClass} inputStyle={inputStyle} />
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

        <div>
          <label className="flex items-start gap-2 text-sm font-bold" style={{ color: "var(--text-dim)" }}>
            <input
              type="checkbox"
              checked={optOut}
              onChange={(e) => setOptOut(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Keep this as a single bout only
              <span className="mt-0.5 block text-xs font-normal" style={{ color: "var(--text-faint)" }}>
                By default, if you win your matchup you may automatically be pooled with other
                category winners into a new bracket. Check this to opt out and stay a standalone
                bout even if you win.
              </span>
            </span>
          </label>
        </div>

        {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
        {success && (
          <p className="text-sm font-medium" style={{ color: "var(--blue)" }}>
            Submission received — pending review. Once approved, we&apos;ll
            automatically match you against another entry in your category.
          </p>
        )}

        <button type="submit" disabled={loading} className="bc-btn-red py-2.5 disabled:opacity-60">
          {loading ? "Submitting..." : "Submit entry"}
        </button>
      </form>
    </div>
  );
}
