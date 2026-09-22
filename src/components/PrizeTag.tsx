type PrizeTagStyle = "minimal" | "bold" | "badge" | string;

export default function PrizeTag({ style, brand }: { style: PrizeTagStyle; brand: string }) {
  const safeBrand = brand.trim() || "our sponsor";

  if (style === "bold") {
    return (
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white"
        style={{ background: "var(--blue)" }}
      >
        🎁 Prizes brought to you by <span className="font-bold">{safeBrand}</span>
      </span>
    );
  }

  if (style === "badge") {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span
          className="flex items-center justify-center rounded-full text-xs text-white"
          style={{ background: "var(--blue)", width: 22, height: 22 }}
        >
          🎁
        </span>
        <span className="flex flex-col leading-tight">
          <span
            className="text-[9px] font-extrabold uppercase tracking-wide"
            style={{ color: "var(--text-faint)" }}
          >
            Prize Sponsor
          </span>
          <span className="text-xs font-bold">{safeBrand}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
      style={{ color: "var(--blue)", background: "var(--blue-soft)" }}
    >
      🎁 Prizes brought to you by <span className="font-bold">{safeBrand}</span>
    </span>
  );
}
