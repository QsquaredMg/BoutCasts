import { money, platformFee, splitEntryFees, PLATFORM_FEE_PCT } from "@/lib/paidBouts";

// The money terms, spelled out with the bout's own numbers. Shown to entrants
// before they pay and to organizers before they publish.
export default function PaidBoutTerms({
  feeCents,
  minEntries,
  prizes,
}: {
  feeCents: number;
  minEntries: number;
  prizes: { place: number; amount_cents: number }[];
}) {
  const prizeTotal = prizes.reduce((s, p) => s + p.amount_cents, 0);
  const atMin = splitEntryFees(minEntries * feeCents, prizeTotal);
  return (
    <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h3 className="mb-2 text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Exactly how the money works
      </h3>
      <ol className="mb-3 list-decimal pl-5" style={{ color: "var(--text-dim)" }}>
        <li>Every entry fee is {money(feeCents)}, paid by card when you enter.</li>
        <li>BoutCasts keeps {PLATFORM_FEE_PCT}% of all entry fees. That covers payment processing and running the bout.</li>
        <li>Prizes are fixed amounts, listed below, and are paid next.</li>
        <li>The organizer receives what is left, and only after the platform fee and every prize have been paid.</li>
        <li>
          If fewer than {minEntries} people enter by the deadline, the bout is cancelled and every entry fee is refunded in full.
        </li>
      </ol>
      <table className="w-full text-left text-sm">
        <caption className="mb-1 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
          Example at the minimum of {minEntries} entries
        </caption>
        <tbody>
          <tr><td className="py-1">Entry fees collected</td><td className="py-1 text-right font-semibold">{money(atMin.gross)}</td></tr>
          <tr><td className="py-1">BoutCasts fee ({PLATFORM_FEE_PCT}%)</td><td className="py-1 text-right">{money(platformFee(atMin.gross))}</td></tr>
          {prizes.map((p) => (
            <tr key={p.place}><td className="py-1">Prize, place {p.place}</td><td className="py-1 text-right">{money(p.amount_cents)}</td></tr>
          ))}
          <tr className="border-t" style={{ borderColor: "var(--border)" }}>
            <td className="py-1 font-semibold">Organizer receives</td>
            <td className="py-1 text-right font-semibold">{money(atMin.organizer)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
        With more entries the prizes stay the same and the extra money after the platform fee goes to the organizer.
      </p>
    </div>
  );
}
