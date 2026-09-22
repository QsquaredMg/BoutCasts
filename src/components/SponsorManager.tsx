"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Sponsor, Category, Bout } from "@/lib/types";

type BoutRow = Pick<Bout, "id" | "title" | "status" | "sponsor_id">;

export default function SponsorManager({
  initialSponsors,
  initialCategories,
  initialBouts,
}: {
  initialSponsors: Sponsor[];
  initialCategories: Category[];
  initialBouts: BoutRow[];
}) {
  const supabase = createClient();
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [categories, setCategories] = useState(initialCategories);
  const [bouts, setBouts] = useState(initialBouts);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tier, setTier] = useState<"title" | "standard">("standard");
  const [opportunityType, setOpportunityType] = useState<
    "" | "commercial" | "bracket" | "bout" | "curated" | "prizes"
  >("");
  const [bannerStyle, setBannerStyle] = useState<"minimal" | "bold" | "badge">("minimal");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    const { data, error } = await supabase
      .from("sponsors")
      .insert({
        name,
        logo_url: logoUrl || null,
        website_url: websiteUrl || null,
        tier,
        opportunity_type: opportunityType || null,
        banner_style: opportunityType === "prizes" ? bannerStyle : null,
      })
      .select()
      .single();

    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSponsors((prev) => [data as Sponsor, ...prev]);
    setName("");
    setLogoUrl("");
    setWebsiteUrl("");
    setTier("standard");
    setOpportunityType("");
    setBannerStyle("minimal");
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error } = await supabase.from("sponsors").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setSponsors((prev) => prev.filter((s) => s.id !== id));
    // clear any assignments that pointed at the deleted sponsor (the FK
    // already sets them to null server-side; keep local state in sync)
    setCategories((prev) =>
      prev.map((c) => (c.sponsor_id === id ? { ...c, sponsor_id: null } : c))
    );
    setBouts((prev) =>
      prev.map((b) => (b.sponsor_id === id ? { ...b, sponsor_id: null } : b))
    );
  }

  async function assignCategorySponsor(categoryId: string, sponsorId: string | null) {
    setError(null);
    const { error } = await supabase
      .from("categories")
      .update({ sponsor_id: sponsorId })
      .eq("id", categoryId);
    if (error) {
      setError(error.message);
      return;
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, sponsor_id: sponsorId } : c))
    );
  }

  async function assignBoutSponsor(boutId: string, sponsorId: string | null) {
    setError(null);
    const { error } = await supabase
      .from("bouts")
      .update({ sponsor_id: sponsorId })
      .eq("id", boutId);
    if (error) {
      setError(error.message);
      return;
    }
    setBouts((prev) =>
      prev.map((b) => (b.id === boutId ? { ...b, sponsor_id: sponsorId } : b))
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Add a sponsor</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex gap-3">
            <input
              type="text"
              required
              placeholder="Sponsor name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as "title" | "standard")}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="title">Title sponsor</option>
            </select>
          </div>
          <input
            type="url"
            placeholder="Logo URL (optional)"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="url"
            placeholder="Website URL (optional)"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-3">
            <select
              value={opportunityType}
              onChange={(e) => setOpportunityType(e.target.value as typeof opportunityType)}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">No opportunity type (plain &quot;Presented by&quot;)</option>
              <option value="commercial">Commercial partner</option>
              <option value="bracket">Bracket sponsor</option>
              <option value="bout">Bout sponsor</option>
              <option value="curated">Curated bout</option>
              <option value="prizes">Prize sponsor</option>
            </select>
            {opportunityType === "prizes" && (
              <select
                value={bannerStyle}
                onChange={(e) => setBannerStyle(e.target.value as "minimal" | "bold" | "badge")}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="minimal">Minimal tag</option>
                <option value="bold">Bold banner</option>
                <option value="badge">Icon badge</option>
              </select>
            )}
          </div>
          <button
            type="submit"
            disabled={creating}
            className="self-start rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {creating ? "Adding..." : "Add sponsor"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All sponsors</h2>
        {sponsors.length === 0 ? (
          <p className="text-sm text-neutral-500">No sponsors yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sponsors.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3"
              >
                <div>
                  <span className="font-medium">{s.name}</span>
                  {s.tier === "title" && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      Title
                    </span>
                  )}
                  {s.website_url && (
                    <a
                      href={s.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-xs text-neutral-400 hover:underline"
                    >
                      {s.website_url}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Category sponsorship</h2>
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3"
            >
              <span className="text-sm font-medium">{c.name}</span>
              <select
                value={c.sponsor_id ?? ""}
                onChange={(e) => assignCategorySponsor(c.id, e.target.value || null)}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              >
                <option value="">No sponsor</option>
                {sponsors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Bout sponsorship</h2>
        {bouts.length === 0 ? (
          <p className="text-sm text-neutral-500">No bouts yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bouts.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3"
              >
                <span className="text-sm font-medium">
                  {b.title}{" "}
                  <span className="text-xs uppercase text-neutral-400">{b.status}</span>
                </span>
                <select
                  value={b.sponsor_id ?? ""}
                  onChange={(e) => assignBoutSponsor(b.id, e.target.value || null)}
                  className="rounded border border-neutral-300 px-2 py-1 text-sm"
                >
                  <option value="">No sponsor</option>
                  {sponsors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
