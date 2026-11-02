import Link from "next/link";
import packet from "@/lib/packetContent.json";

export const metadata = { title: "Candidate and campaign manager packet" };

type Section = { heading: string; bullets?: string[]; numbered?: string[] };
type Part = { heading: string; intro: string; sections: Section[] };

// The packet for candidates and campaign managers: survey guide, field notes sheet and fundraising guide.
export default function PacketPage() {
  const parts = packet.parts as Part[];
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-extrabold">{packet.title}</h1>
      <p className="mt-1 text-base" style={{ color: "var(--text-dim)" }}>{packet.subtitle}</p>
      <p className="mt-3"><a href="/guides/candidate-campaign-packet.pdf" className="font-bold underline" download>Download the packet (PDF)</a></p>
      {parts.map((part) => (
        <section key={part.heading} className="mt-8">
          <h2 className="text-2xl font-extrabold">{part.heading}</h2>
          <p className="mt-1 text-sm">{part.intro}</p>
          {part.sections.map((s) => (
            <div key={s.heading} className="mt-4">
              <h3 className="text-lg font-bold">{s.heading}</h3>
              {s.bullets && <ul className="mt-1 list-disc pl-5 text-sm">{s.bullets.map((b) => <li key={b} className="mt-1">{b}</li>)}</ul>}
              {s.numbered && <ol className="mt-1 list-decimal pl-5 text-sm">{s.numbered.map((b) => <li key={b} className="mt-1">{b}</li>)}</ol>}
            </div>
          ))}
        </section>
      ))}
      <p className="mt-8 text-xs" style={{ color: "var(--text-faint)" }}>{packet.footer}</p>
      <p className="mt-2 text-sm"><Link href="/schools" className="underline">About School Elections</Link></p>
    </div>
  );
}
