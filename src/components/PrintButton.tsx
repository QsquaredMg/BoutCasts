"use client";

export default function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold print:hidden">
      {label}
    </button>
  );
}
