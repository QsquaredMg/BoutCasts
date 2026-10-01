"use client";

export default function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bc-btn-solid rounded-full px-4 py-1.5 text-xs font-bold"
    >
      {label}
    </button>
  );
}
