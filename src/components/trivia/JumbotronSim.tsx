"use client";

import { useEffect, useState } from "react";
import css from "./JumbotronSim.module.css";

// A looping simulation of the BoutCasts trivia module on an arena video board,
// with the matching phone screen beside it. Sample content only.
const PHASES = [
  { id: "join", ms: 4200, label: "Join" },
  { id: "ask", ms: 7000, label: "Question" },
  { id: "reveal", ms: 5200, label: "Reveal" },
  { id: "board", ms: 5400, label: "Leaders" },
] as const;
const TOTAL = PHASES.reduce((a, p) => a + p.ms, 0);
const COLORS = ["#e5263b", "#1b4fe4", "#f2a900", "#16a34a"];
const OPTS = ["Third quarter", "Halftime", "Second quarter", "Overtime"];
const SPLIT = [14, 21, 57, 8];
const RIGHT = 2;
const SECTIONS = [["Section 112", 18420, "#e5263b"], ["Section 214", 16980, "#1b4fe4"]] as const;
const FANS = [["Keisha W.", 940], ["Marcus T.", 905], ["Priya S.", 880], ["Diego R.", 860], ["Aaliyah M.", 845]] as const;
const CROWD = "🙌🏾🙌🏻🙌🏽🙌🏿🙌🏼🙌🏾🙌🏻🙌🏽🙌🏿🙌🏼🙌🏾🙌🏻🙌🏽";
const QR = Array.from({ length: 121 }, (_, i) => {
  const x = i % 11, y = Math.floor(i / 11);
  const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
  return corner ? !(x % 2 === 1 && y % 2 === 1 && false) : ((x * 7 + y * 13 + x * y) % 3 !== 0);
});

export default function JumbotronSim() {
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setT((v) => (v + 100) % TOTAL), 100);
    return () => clearInterval(id);
  }, [paused]);

  let idx = 0;
  let within = t;
  for (let i = 0; i < PHASES.length; i++) {
    if (within < PHASES[i].ms) { idx = i; break; }
    within -= PHASES[i].ms;
  }
  const phase = PHASES[idx].id;
  const jump = (i: number) => setT(PHASES.slice(0, i).reduce((a, p) => a + p.ms, 0));
  const secs = Math.max(0, Math.ceil((PHASES[1].ms - within) / 1000) + 3);
  const joined = 11800 + Math.round(Math.min(1, t / 3800) * 1260);

  return (
    <div className={css.arena} aria-label="Simulation of BoutCasts trivia on an arena video board">
      <div className={css.beams} />
      <div className={css.stage}>
        <div>
          <div className={css.board}>
            <div className={css.led}>
              <div className={css.tag}>
                <span>Live trivia · Home opener</span>
                <span className={css.logo}>BOUTCASTS</span>
              </div>

              {phase === "join" && (
                <>
                  <div className={css.big}>Scan. Join. Win the arena.</div>
                  <div className={css.row}>
                    <div>
                      <div className={css.sub}>Code</div>
                      <div className={css.code}>HOME1</div>
                      <div className={css.sub} style={{ marginTop: 8 }}>boutcasts.com/trivia</div>
                      <div className={css.big} style={{ margin: "8px 0 0", color: "#ffc531" }}>{joined.toLocaleString()} fans in</div>
                    </div>
                    <div className={css.qr} aria-hidden>
                      {QR.map((on, i) => <i key={i} className={on ? "" : css.o} />)}
                    </div>
                  </div>
                </>
              )}

              {(phase === "ask" || phase === "reveal") && (
                <>
                  <div className={css.row} style={{ justifyContent: "space-between" }}>
                    <span className={css.tag} style={{ gap: 8 }}>Question 3 of 10 · Sample</span>
                    {phase === "ask" ? <span className={css.clock}>{secs}</span> : <span className={css.sub}>12,540 answered</span>}
                  </div>
                  <div className={css.big}>In which quarter did the home team take its first lead?</div>
                  <div className={css.opts}>
                    {OPTS.map((o, i) => {
                      const show = phase === "reveal";
                      return (
                        <div key={o} className={`${css.opt} ${show && i === RIGHT ? css.right : ""} ${show && i !== RIGHT ? css.dim : ""}`} style={{ background: COLORS[i] }}>
                          <i className={css.fill} style={{ width: show ? `${SPLIT[i]}%` : "0%" }} />
                          <span>{o}</span>
                          {show && <b>{SPLIT[i]}%{i === RIGHT ? " ✓" : ""}</b>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {phase === "board" && (
                <>
                  <div className={css.big} style={{ marginTop: 6 }}>Section battle</div>
                  <div className={css.bars}>
                    {SECTIONS.map(([n, v, c]) => (
                      <div key={n} className={css.bar}>
                        <span style={{ minWidth: "7.5em" }}>{n}</span>
                        <div className={css.track}><i style={{ width: `${(v / 20000) * 100}%`, background: c }} /></div>
                        <span>{v.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className={css.sub} style={{ margin: "10px 0 4px", color: "#ffc531", fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>Top fans</div>
                  <div className={css.sub} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", fontWeight: 800 }}>
                    {FANS.map(([n, s], i) => <span key={n}>{i + 1}. {n} · {s}</span>)}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className={css.legs} />
        </div>

        <div className={css.phone} aria-hidden>
          <div className={css.scr}>
            <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.8 }}><span>Fan</span><b style={{ color: "#ffc531" }}>{phase === "join" ? "0 pts" : "640 pts"}</b></div>
            {phase === "join" && (<><div className={css.pq} style={{ marginTop: 40, textAlign: "center", fontSize: 18 }}>You&apos;re in!</div><div style={{ textAlign: "center", opacity: 0.8 }}>Eyes on the big screen.</div></>)}
            {phase === "ask" && (<><div className={css.pq}>In which quarter did the home team take its first lead?</div>
              {OPTS.map((o, i) => <button key={o} className={`${css.pb} ${i === RIGHT && within > 2600 ? css.pbSel : ""}`} style={{ background: COLORS[i] }}>{o}</button>)}
              <div style={{ textAlign: "center", opacity: 0.8 }}>{within > 2600 ? "Locked in" : "2× Double · 💡 Hint"}</div></>)}
            {phase === "reveal" && (<><div className={css.pts}>+92</div><div style={{ textAlign: "center", fontWeight: 800 }}>Correct. Fast hands.</div><div style={{ textAlign: "center", opacity: 0.8, marginTop: 6 }}>Rank 1,204 of 13,060</div></>)}
            {phase === "board" && (<><div className={css.pts} style={{ marginTop: 10 }}>#1,204</div><div style={{ textAlign: "center", fontWeight: 800 }}>Your section is up 1,440</div><button className={css.pb} style={{ background: "#ffc531", color: "#000", textAlign: "center", marginTop: 12 }}>Share my score</button></>)}
          </div>
        </div>
      </div>

      <div className={css.crowd} aria-hidden>{CROWD}{CROWD}{CROWD}</div>
      <div className={css.ctl}>
        {PHASES.map((p, i) => (
          <button key={p.id} className={`${css.dot} ${i === idx ? css.dotOn : ""}`} onClick={() => jump(i)} aria-label={`Show ${p.label}`} title={p.label} />
        ))}
        <button className={css.pause} onClick={() => setPaused((v) => !v)}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
      </div>
      <p className={css.note}>Simulation with sample questions and numbers.</p>
    </div>
  );
}
