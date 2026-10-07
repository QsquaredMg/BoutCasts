import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { cond } from "@/app/predictions/font";
import s from "./funnel.module.css";

// One layout, five products. Every funnel page passes its own palette, copy and
// hero visual; the structure (hero, ticker, steps, feature bento, use cases,
// pricing, FAQ, closing call to action) stays the same so the set feels like a
// family.

export type Theme = {
  deep: string; // darkest background
  deep2: string; // second dark tone
  accent: string; // bright product color
  accentInk: string; // text on top of accent
  accentDark: string; // accent that is readable on white
  gold: string; // call-to-action color
  goldGlow: string; // glow behind the CTA
  glow: string; // hero glow (rgba)
  glow2: string; // lower-left hero glow (rgba)
  soft: string; // body text on dark
  paper: string; // light section background
};

type Cta = { label: string; href: string };

export type FunnelProps = {
  theme: Theme;
  kicker: string;
  live?: boolean;
  title: string[]; // lines; wrap a word in [[ ]] to color it
  lede: string;
  primary: Cta;
  secondary?: Cta;
  fine?: string;
  visual: ReactNode;
  ticker: string[];
  stepsTitle: string;
  stepsLede: string;
  steps: { title: string; body: string }[];
  featuresTitle: string;
  featuresLede: string;
  features: { icon: string; title: string; body: string; span?: 2 | 3; hot?: boolean }[];
  usesTitle: string;
  uses: { emoji: string; title: string; body: string }[];
  tiers?: {
    eyebrow: string;
    title: string;
    lede: string;
    cards: { label: string; price: string; unit?: string; sub: string; perks: string[]; cta: Cta; hot?: boolean; tag?: string }[];
    note?: string;
  };
  faq: { q: string; a: string }[];
  closing: { headline: string; body: string; primary: Cta; secondary?: Cta };
  crossLinks?: { label: string; href: string }[];
};

function renderTitle(line: string) {
  const parts = line.split(/(\[\[.*?\]\])/g);
  return parts.map((p, i) =>
    p.startsWith("[[") ? <em key={i}>{p.slice(2, -2)}</em> : <span key={i}>{p}</span>
  );
}

export default function Funnel(p: FunnelProps) {
  const t = p.theme;
  const vars = {
    "--deep": t.deep,
    "--deep2": t.deep2,
    "--accent": t.accent,
    "--accentInk": t.accentInk,
    "--accentDark": t.accentDark,
    "--gold": t.gold,
    "--goldGlow": t.goldGlow,
    "--glow": t.glow,
    "--glow2": t.glow2,
    "--soft": t.soft,
    "--paper": t.paper,
    "--ink": "#0a0e1a",
    "--cols": p.tiers?.cards.length ?? 3,
  } as CSSProperties;
  const ticker = [...p.ticker, ...p.ticker];

  return (
    <div className={`${s.root} ${cond.variable}`} style={vars}>
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={s.heroGrid}>
            <div>
              <span className={s.kicker}>
                {p.live && <span className={s.dot} aria-hidden="true" />}
                {p.kicker}
              </span>
              <h1 className={s.h1}>
                {p.title.map((line, i) => (
                  <span key={i} style={{ display: "block" }}>
                    {renderTitle(line)}
                  </span>
                ))}
              </h1>
              <p className={s.lede}>{p.lede}</p>
              <div className={s.ctaRow}>
                <Link href={p.primary.href} className={s.btnMain}>
                  {p.primary.label}
                </Link>
                {p.secondary && (
                  <Link href={p.secondary.href} className={s.btnGhost}>
                    {p.secondary.label}
                  </Link>
                )}
              </div>
              {p.fine && <p className={s.fine}>{p.fine}</p>}
            </div>
            <div className={s.stage} aria-hidden="true">
              {p.visual}
            </div>
          </div>
        </div>
      </section>

      <div className={s.ticker} aria-hidden="true">
        <div className={s.tickTrack}>
          {ticker.map((w, i) => (
            <span key={i}>
              {w} <i>★</i>
            </span>
          ))}
        </div>
      </div>

      <section className={`${s.sec} ${s.paper}`}>
        <div className={s.wrap}>
          <p className={s.eyebrow}>How it works</p>
          <h2 className={s.secTitle}>{p.stepsTitle}</h2>
          <p className={s.secLede}>{p.stepsLede}</p>
          <ol className={s.steps}>
            {p.steps.map((st, i) => (
              <li key={st.title} className={s.step}>
                <div className={s.stepN}>{i + 1}</div>
                <h3>{st.title}</h3>
                <p>{st.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${s.sec} ${s.night}`}>
        <div className={s.wrap}>
          <p className={s.eyebrow}>What you get</p>
          <h2 className={s.secTitle}>{p.featuresTitle}</h2>
          <p className={s.secLede}>{p.featuresLede}</p>
          <div className={s.bento}>
            {p.features.map((f) => (
              <div key={f.title} className={`${s.card} ${f.span === 3 ? s.b3 : s.b2} ${f.hot ? s.cardHot : ""}`}>
                <div className={s.icon}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.sec} ${s.paper}`}>
        <div className={s.wrap}>
          <p className={s.eyebrow}>Built for</p>
          <h2 className={s.secTitle}>{p.usesTitle}</h2>
          <div className={s.uses}>
            {p.uses.map((u, i) => (
              <div key={u.title} className={`${s.use} ${s[`u${i % 6}`]}`}>
                <span className={s.emoji} aria-hidden="true">
                  {u.emoji}
                </span>
                <div>
                  <h3>{u.title}</h3>
                  <p style={{ marginTop: 10 }}>{u.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {p.tiers && (
        <section className={`${s.sec} ${s.night}`}>
          <div className={s.wrap}>
            <p className={s.eyebrow}>{p.tiers.eyebrow}</p>
            <h2 className={s.secTitle}>{p.tiers.title}</h2>
            <p className={s.secLede}>{p.tiers.lede}</p>
            <div className={s.tickets}>
              {p.tiers.cards.map((c) => (
                <div key={c.label} className={`${s.tk} ${c.hot ? s.tkHot : ""}`}>
                  {c.tag && <span className={s.tkTag}>{c.tag}</span>}
                  <h3>{c.label}</h3>
                  <div className={s.price}>
                    {c.price}
                    {c.unit && <small>{c.unit}</small>}
                  </div>
                  <p className={s.tkSub}>{c.sub}</p>
                  <ul className={s.perks}>
                    {c.perks.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                  <Link href={c.cta.href} className={s.tkBtn}>
                    {c.cta.label}
                  </Link>
                </div>
              ))}
            </div>
            {p.tiers.note && <p className={s.priceNote}>{p.tiers.note}</p>}
          </div>
        </section>
      )}

      <section className={`${s.sec} ${s.paper}`}>
        <div className={s.wrap}>
          <p className={s.eyebrow}>Questions</p>
          <h2 className={s.secTitle}>Straight answers</h2>
          <div className={s.faq}>
            {p.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={s.final}>
        <h2 className={s.finalH}>{p.closing.headline}</h2>
        <p>{p.closing.body}</p>
        <div className={s.finalRow}>
          <Link href={p.closing.primary.href} className={s.btnMain}>
            {p.closing.primary.label}
          </Link>
          {p.closing.secondary && (
            <Link href={p.closing.secondary.href} className={s.btnGhost}>
              {p.closing.secondary.label}
            </Link>
          )}
        </div>
        {p.crossLinks && (
          <p className={s.crossLinks}>
            More from BoutCasts:{" "}
            {p.crossLinks.map((l, i) => (
              <span key={l.href}>
                {i > 0 && " · "}
                <Link href={l.href}>{l.label}</Link>
              </span>
            ))}
          </p>
        )}
      </section>
    </div>
  );
}

// Re-export the style classes the hero visuals use, so visuals stay in one file.
export { s as fx };
