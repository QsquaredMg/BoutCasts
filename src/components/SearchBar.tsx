"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Client-side search input: shows a visible submit button (so the field
// never looks like it's doing nothing), and also pushes live-as-you-type
// results via a debounced router.replace once the user pauses typing.
// Falls back to a plain GET submit if JS never loads.
export default function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function navigate(q: string) {
    const trimmed = q.trim();
    router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search", {
      scroll: false,
    });
  }

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), 350);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(value);
  }

  return (
    <form action="/search" method="get" onSubmit={handleSubmit} className="mb-8">
      <div
        className="flex items-center gap-2 rounded-full border px-2 py-1.5 pl-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          autoFocus
          placeholder="Search BoutCasts…"
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"
          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </button>
      </div>
    </form>
  );
}
