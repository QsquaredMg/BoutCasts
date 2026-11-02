"use client";

export default function SurveyPrintButton() {
  return <button onClick={() => window.print()} className="rounded-full bg-[#1b4fe4] px-4 py-2 text-sm font-bold text-white">Print</button>;
}
