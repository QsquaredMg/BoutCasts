import Link from "next/link";

/** Night-stadium page header used across Bout Predictions. */
export default function PredHero({
  title, sub, kicker, back = true, backHref = "/predictions", backLabel = "Bout Predictions", live, small, wide, children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  kicker?: React.ReactNode;
  back?: boolean;
  backHref?: string;
  backLabel?: string;
  live?: boolean;
  small?: boolean;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="pt-hero">
      <div className={`pt-in${wide ? " wide" : ""}`}>
        {back && <Link href={backHref} className="pt-back">&larr; {backLabel}</Link>}
        {kicker && <p className="pt-kick">{live && <span className="pt-live" aria-hidden />}{kicker}</p>}
        <h1 className={`pt-h1${small ? " sm" : ""}`}>{title}</h1>
        {sub && <p className="pt-sub">{sub}</p>}
        {children}
      </div>
    </header>
  );
}
