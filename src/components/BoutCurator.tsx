"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Bout, Category } from "@/lib/types";
import FileUploadPicker from "@/components/FileUploadPicker";

type SubmissionRow = {
  id: string;
  title: string;
  category_id: string;
  used: boolean;
};

type Sponsor = { id: string; name: string };

const EMPTY_FORM = {
  category_id: "",
  title: "",
  competitor_a_name: "",
  competitor_a_submission_id: "",
  competitor_a_upload_url: "",
  competitor_b_name: "",
  competitor_b_submission_id: "",
  competitor_b_upload_url: "",
  status: "live" as "upcoming" | "live" | "final",
  closes_at: "",
  round_theme_name: "",
  round_theme_rules: "",
  sponsor_id: "",
};

type FormState = typeof EMPTY_FORM;

export default function BoutCurator({
  initialBouts,
  categories,
  sponsors,
  submissions,
  tallyByBout,
}: {
  initialBouts: Bout[];
  categories: Category[];
  sponsors: Sponsor[];
  submissions: SubmissionRow[];
  tallyByBout: Record<string, { a: number; b: number }>;
}) {
  const supabase = createClient();
  const [bouts, setBouts] = useState(initialBouts);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    category_id: categories[0]?.id ?? "",
  });
  const [formResetKey, setFormResetKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submissionsInCategory = useMemo(
    () => submissions.filter((s) => s.category_id === form.category_id && !s.used),
    [submissions, form.category_id]
  );
  const editSubmissionsInCategory = useMemo(
    () => submissions.filter((s) => s.category_id === editForm.category_id),
    [submissions, editForm.category_id]
  );

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  }

  // Creates a new `submissions` row for a clip the admin just uploaded
  // directly in BoutCurator, and immediately approves it (via the
  // moderate_submission RPC) so it's visible to everyone, not just the
  // admin/owner, per the submissions_select_approved_or_own_or_admin policy.
  async function createApprovedSubmission(
    categoryId: string,
    title: string,
    sourceUrl: string
  ): Promise<{ id: string } | { error: string }> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { error: "You must be signed in to attach an uploaded clip." };

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        user_id: user.id,
        category_id: categoryId,
        title,
        source_type: "upload",
        source_url: sourceUrl,
        entry_type: "free",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "Could not save the uploaded clip." };
    }

    const { error: modError } = await supabase.rpc("moderate_submission", {
      p_submission_id: data.id,
      p_approve: true,
    });
    if (modError) {
      return { error: `Clip uploaded but couldn't be approved: ${modError.message}` };
    }

    return { id: data.id as string };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.category_id || !form.title.trim() || !form.competitor_a_name.trim() || !form.competitor_b_name.trim()) {
      setError("Category, title, and both competitor names are required.");
      return;
    }

    setCreating(true);

    let aSubmissionId = form.competitor_a_submission_id || null;
    if (!aSubmissionId && form.competitor_a_upload_url) {
      const result = await createApprovedSubmission(
        form.category_id,
        `${form.title.trim()} — ${form.competitor_a_name.trim()}`,
        form.competitor_a_upload_url
      );
      if ("error" in result) {
        setCreating(false);
        setError(`Competitor A clip: ${result.error}`);
        return;
      }
      aSubmissionId = result.id;
    }

    let bSubmissionId = form.competitor_b_submission_id || null;
    if (!bSubmissionId && form.competitor_b_upload_url) {
      const result = await createApprovedSubmission(
        form.category_id,
        `${form.title.trim()} — ${form.competitor_b_name.trim()}`,
        form.competitor_b_upload_url
      );
      if ("error" in result) {
        setCreating(false);
        setError(`Competitor B clip: ${result.error}`);
        return;
      }
      bSubmissionId = result.id;
    }

    const { data, error } = await supabase
      .from("bouts")
      .insert({
        category_id: form.category_id,
        title: form.title.trim(),
        competitor_a_name: form.competitor_a_name.trim(),
        competitor_a_submission_id: aSubmissionId,
        competitor_b_name: form.competitor_b_name.trim(),
        competitor_b_submission_id: bSubmissionId,
        status: form.status,
        closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
        round_theme_name: form.round_theme_name.trim() || null,
        round_theme_rules: form.round_theme_rules.trim() || null,
        sponsor_id: form.sponsor_id || null,
      })
      .select()
      .single();

    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setBouts((prev) => [data as Bout, ...prev]);
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? "" });
    setFormResetKey((k) => k + 1);
  }

  function startEdit(b: Bout) {
    setEditingId(b.id);
    setEditForm({
      category_id: b.category_id,
      title: b.title,
      competitor_a_name: b.competitor_a_name,
      competitor_a_submission_id: b.competitor_a_submission_id ?? "",
      competitor_a_upload_url: "",
      competitor_b_name: b.competitor_b_name,
      competitor_b_submission_id: b.competitor_b_submission_id ?? "",
      competitor_b_upload_url: "",
      status: b.status,
      closes_at: b.closes_at ? b.closes_at.slice(0, 16) : "",
      round_theme_name: b.round_theme_name ?? "",
      round_theme_rules: b.round_theme_rules ?? "",
      sponsor_id: b.sponsor_id ?? "",
    });
  }

  async function saveEdit(id: string) {
    setError(null);
    setBusyId(id);

    let aSubmissionId = editForm.competitor_a_submission_id || null;
    if (!aSubmissionId && editForm.competitor_a_upload_url) {
      const result = await createApprovedSubmission(
        editForm.category_id,
        `${editForm.title.trim()} — ${editForm.competitor_a_name.trim()}`,
        editForm.competitor_a_upload_url
      );
      if ("error" in result) {
        setBusyId(null);
        setError(`Competitor A clip: ${result.error}`);
        return;
      }
      aSubmissionId = result.id;
    }

    let bSubmissionId = editForm.competitor_b_submission_id || null;
    if (!bSubmissionId && editForm.competitor_b_upload_url) {
      const result = await createApprovedSubmission(
        editForm.category_id,
        `${editForm.title.trim()} — ${editForm.competitor_b_name.trim()}`,
        editForm.competitor_b_upload_url
      );
      if ("error" in result) {
        setBusyId(null);
        setError(`Competitor B clip: ${result.error}`);
        return;
      }
      bSubmissionId = result.id;
    }

    const { error } = await supabase
      .from("bouts")
      .update({
        category_id: editForm.category_id,
        title: editForm.title.trim(),
        competitor_a_name: editForm.competitor_a_name.trim(),
        competitor_a_submission_id: aSubmissionId,
        competitor_b_name: editForm.competitor_b_name.trim(),
        competitor_b_submission_id: bSubmissionId,
        status: editForm.status,
        closes_at: editForm.closes_at ? new Date(editForm.closes_at).toISOString() : null,
        round_theme_name: editForm.round_theme_name.trim() || null,
        round_theme_rules: editForm.round_theme_rules.trim() || null,
        sponsor_id: editForm.sponsor_id || null,
      })
      .eq("id", id)
      .select()
      .single();

    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setBouts((prev) =>
      prev.map((b) =>
        b.id === id
          ? ({ ...b, ...editForm, competitor_a_submission_id: aSubmissionId, competitor_b_submission_id: bSubmissionId } as Bout)
          : b
      )
    );
    setEditingId(null);
  }

  async function closeBout(id: string) {
    setError(null);
    setBusyId(id);
    const { error } = await supabase.rpc("close_bout", { p_bout_id: id });
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setBouts((prev) => prev.map((b) => (b.id === id ? { ...b, status: "final" } : b)));
  }

  async function deleteBout(id: string) {
    setError(null);
    setBusyId(id);
    const { error } = await supabase.from("bouts").delete().eq("id", id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setBouts((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <section>
        <h3 className="mb-3 text-lg font-semibold">Create a bout</h3>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Bout title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <select
              value={form.sponsor_id}
              onChange={(e) => setForm((f) => ({ ...f, sponsor_id: e.target.value }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">No sponsor</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
              <input
                type="text"
                required
                placeholder="Competitor A name"
                value={form.competitor_a_name}
                onChange={(e) => setForm((f) => ({ ...f, competitor_a_name: e.target.value }))}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <select
                value={form.competitor_a_submission_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, competitor_a_submission_id: e.target.value, competitor_a_upload_url: "" }))
                }
                className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
              >
                <option value="">Not linked to a submission</option>
                {submissionsInCategory.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              {!form.competitor_a_submission_id && (
                <div className="mt-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-neutral-400">
                    Or upload a clip directly
                  </p>
                  <FileUploadPicker
                    key={`a-${formResetKey}`}
                    onUploaded={(url) => setForm((f) => ({ ...f, competitor_a_upload_url: url ?? "" }))}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
              <input
                type="text"
                required
                placeholder="Competitor B name"
                value={form.competitor_b_name}
                onChange={(e) => setForm((f) => ({ ...f, competitor_b_name: e.target.value }))}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <select
                value={form.competitor_b_submission_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, competitor_b_submission_id: e.target.value, competitor_b_upload_url: "" }))
                }
                className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
              >
                <option value="">Not linked to a submission</option>
                {submissionsInCategory.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              {!form.competitor_b_submission_id && (
                <div className="mt-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-neutral-400">
                    Or upload a clip directly
                  </p>
                  <FileUploadPicker
                    key={`b-${formResetKey}`}
                    onUploaded={(url) => setForm((f) => ({ ...f, competitor_b_upload_url: url ?? "" }))}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
            </select>
            <input
              type="datetime-local"
              value={form.closes_at}
              onChange={(e) => setForm((f) => ({ ...f, closes_at: e.target.value }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              title="Voting closes at"
            />
            <input
              type="text"
              placeholder="Round theme name (optional)"
              value={form.round_theme_name}
              onChange={(e) => setForm((f) => ({ ...f, round_theme_name: e.target.value }))}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Round theme rules (optional)"
            value={form.round_theme_rules}
            onChange={(e) => setForm((f) => ({ ...f, round_theme_rules: e.target.value }))}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            rows={2}
          />

          <button
            type="submit"
            disabled={creating}
            className="self-start rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create bout"}
          </button>
        </form>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">All bouts</h3>
        {bouts.length === 0 ? (
          <p className="text-sm text-neutral-500">No bouts yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {bouts.map((b) => {
              const tally = tallyByBout[b.id] ?? { a: 0, b: 0 };
              const editing = editingId === b.id;
              return (
                <div key={b.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                  {!editing ? (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{b.title}</span>
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-500">
                            {b.status}
                          </span>
                          <span className="text-xs text-neutral-400">{categoryName(b.category_id)}</span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          {b.competitor_a_name} ({tally.a}) vs {b.competitor_b_name} ({tally.b})
                          {b.winner_side && (
                            <span className="ml-1 font-semibold text-amber-700">
                              — winner: {b.winner_side === "a" ? b.competitor_a_name : b.competitor_b_name}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/api/bouts/${b.id}/vote-card`}
                          target="_blank"
                          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                        >
                          Vote graphic
                        </Link>
                        <Link
                          href={`/bout/${b.id}`}
                          target="_blank"
                          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => startEdit(b)}
                          className="rounded border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        {b.status !== "final" && (
                          <button
                            onClick={() => closeBout(b.id)}
                            disabled={busyId === b.id}
                            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                          >
                            Close &amp; decide winner
                          </button>
                        )}
                        <button
                          onClick={() => deleteBout(b.id)}
                          disabled={busyId === b.id}
                          className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-3">
                        <select
                          value={editForm.category_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value }))}
                          className="rounded border border-neutral-300 px-3 py-2 text-sm"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
                        />
                        <select
                          value={editForm.sponsor_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, sponsor_id: e.target.value }))}
                          className="rounded border border-neutral-300 px-3 py-2 text-sm"
                        >
                          <option value="">No sponsor</option>
                          {sponsors.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
                          <input
                            type="text"
                            value={editForm.competitor_a_name}
                            onChange={(e) => setEditForm((f) => ({ ...f, competitor_a_name: e.target.value }))}
                            className="rounded border border-neutral-300 px-3 py-2 text-sm"
                          />
                          <select
                            value={editForm.competitor_a_submission_id}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                competitor_a_submission_id: e.target.value,
                                competitor_a_upload_url: "",
                              }))
                            }
                            className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">Not linked to a submission</option>
                            {editSubmissionsInCategory.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>
                          {!editForm.competitor_a_submission_id && (
                            <div className="mt-1">
                              <p className="mb-1 text-[11px] font-semibold uppercase text-neutral-400">
                                Or upload a clip directly
                              </p>
                              <FileUploadPicker
                                onUploaded={(url) =>
                                  setEditForm((f) => ({ ...f, competitor_a_upload_url: url ?? "" }))
                                }
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
                          <input
                            type="text"
                            value={editForm.competitor_b_name}
                            onChange={(e) => setEditForm((f) => ({ ...f, competitor_b_name: e.target.value }))}
                            className="rounded border border-neutral-300 px-3 py-2 text-sm"
                          />
                          <select
                            value={editForm.competitor_b_submission_id}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                competitor_b_submission_id: e.target.value,
                                competitor_b_upload_url: "",
                              }))
                            }
                            className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">Not linked to a submission</option>
                            {editSubmissionsInCategory.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>
                          {!editForm.competitor_b_submission_id && (
                            <div className="mt-1">
                              <p className="mb-1 text-[11px] font-semibold uppercase text-neutral-400">
                                Or upload a clip directly
                              </p>
                              <FileUploadPicker
                                onUploaded={(url) =>
                                  setEditForm((f) => ({ ...f, competitor_b_upload_url: url ?? "" }))
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))}
                          className="rounded border border-neutral-300 px-3 py-2 text-sm"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="live">Live</option>
                          {editForm.status === "final" && <option value="final">Final</option>}
                        </select>
                        <input
                          type="datetime-local"
                          value={editForm.closes_at}
                          onChange={(e) => setEditForm((f) => ({ ...f, closes_at: e.target.value }))}
                          className="rounded border border-neutral-300 px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Round theme name"
                          value={editForm.round_theme_name}
                          onChange={(e) => setEditForm((f) => ({ ...f, round_theme_name: e.target.value }))}
                          className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <textarea
                        placeholder="Round theme rules"
                        value={editForm.round_theme_rules}
                        onChange={(e) => setEditForm((f) => ({ ...f, round_theme_rules: e.target.value }))}
                        className="rounded border border-neutral-300 px-3 py-2 text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(b.id)}
                          disabled={busyId === b.id}
                          className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                        >
                          {busyId === b.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
