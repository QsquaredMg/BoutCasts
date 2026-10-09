import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { cond } from "../font";
import { SCORING } from "@/lib/predictions/scoring";
import { BRACKET_PRICING, money } from "@/lib/predictions/pricing";
import s from "./play.module.css";


export const metadata: Metadata = {
  title: "Run your own prediction game",
  description:
    "Turn any game into a contest. Friends, classes, teams and crowds pick the winner and the final score, earn points, and climb a live leaderboard. Players always play free.",
  alternates: { canonical: "/predictions/play" },
};

const STEPS = [
  { t: "Set up a game", d: "Pick two teams and a start time. Logos fill in for pro and college teams, or add your own." },
  { t: "Share one link", d: "Text it, post it, or hand out a join code. Players only need an account, never a payment." },
  { t: "Everyone calls it", d: "Each player picks the winner and the final score before the game starts." },
  { t: "Points and bragging rights", d: "When the game ends, picks are graded automatically and the leaderboard updates." },
];

const TICKER = ["Friday night lights", "Band battles", "Homecoming week", "Rivalry games", "Watch parties", "Classroom contests", "Family group chats"];

const USES = [
  { c: "u1", i: "🎓", t: "Classrooms and school spirit", d: "Run friendly rivalry games around the home team. A natural way to practice reading stats and making a call." },
  { c: "u2", i: "👨‍👩‍👧‍👦", t: "Family and friend groups", d: "Settle who really knows the game. A private game with a join code keeps the bragging rights in the group chat." },
  { c: "u3", i: "🍔", t: "Bars, restaurants and watch parties", d: "Give the room a reason to stay for the whole game. Put a QR code on the table and post the leaderboard." },
  { c: "u4", i: "📣", t: "Booster clubs and school events", d: "Build buzz before game night and give supporters something to talk about all week." },
  { c: "u5", i: "🎙️", t: "Creators and communities", d: "Add a game to your stream, show or newsletter and turn viewers into a competing community." },
  { c: "u6", i: "🤝", t: "Local sponsors", d: "A game fans return to every week is a place for a local business to be seen. Ask about sponsoring a game or season." },
];

const FAQ = [
  { q: "Do players have to pay?", a: "No. Players always play free. Organizers get one free single game every two weeks." },
  { q: "How do I keep a game private?", a: `A private game is invite-only and costs ${money(BRACKET_PRICING.privateGameCents)} per game. Invitees join with a code and play free.` },
  { q: "What about brackets?", a: `A bracket with many games is ${money(BRACKET_PRICING.weeklyCents)} and stays open ${BRACKET_PRICING.weeklyDays} days, or ${money(BRACKET_PRICING.seasonCents)} to stay open all season.` },
  { q: "When do picks lock?", a: "15 minutes after the game's start time." },
  { q: "Is this gambling?", a: "No. There is no money in play for players. It is points and bragging rights only." },
];

const PEOPLE = [
  { n: "Maya T.", p: 42, bg: "linear-gradient(135deg,#7a4a2b,#b5764a)" },
  { n: "Deon W.", p: 39, bg: "linear-gradient(135deg,#1b4fe4,#6e97ff)" },
  { n: "Priya S.", p: 36, bg: "linear-gradient(135deg,#a8561f,#e0a15b)" },
  { n: "Luis R.", p: 31, bg: "linear-gradient(135deg,#0e7c6b,#4cc2a8)" },
];

const bar = (v: number): CSSProperties => ({ width: `${(v / SCORING.perfect) * 100}%` });

export default function PredictionsFunnelPage() {
  return (
    <div className={`${s.root} ${cond.variable}`}>
      {/* HERO */}
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={s.heroGrid}>
            <div>
              <p className={s.kicker}><span className={s.dot} aria-hidden /> Bout Predictions · players always play free</p>
              <h1 className={s.h1}>Make every game a contest.</h1>
              <p className={s.lede}>
                Share one link and your friends, class, team or crowd pick the winner and the final score, earn points, and climb a live leaderboard.
              </p>
              <div className={s.ctaRow}>
                <Link href="/predictions/new" className={s.btnGold}>Start a free game</Link>
                <Link href="/predictions" className={s.btnGhost}>Browse open games</Link>
              </div>
              <p className={s.fine}>One free game every two weeks. No card needed.</p>
            </div>

            <div className={s.stage} aria-hidden>
              <div className={`${s.chip} ${s.chipB}`}>
                <em>The crowd is leaning</em>
                Eagles 62%
                <div className={s.mini}><span style={{ width: "62%", background: "#1b4fe4" }} /><span style={{ width: "38%", background: "#ffc531" }} /></div>
              </div>
              <div className={s.slip}>
                <div className={s.slipTop}><span>Your pick</span><span>Homecoming game</span></div>
                <div className={s.slipBody}>
                  <div className={s.teams}>
                    <div className={s.team}><div className={s.crest} style={{ background: "#1b4fe4" }}>E</div><b>Eagles</b></div>
                    <div className={s.vs}>vs</div>
                    <div className={s.team}><div className={s.crest} style={{ background: "#e08a00" }}>T</div><b>Tigers</b></div>
                  </div>
                  <div className={s.board}>
                    <div className={`${s.digits} ${s.count}`} style={{ "--to": 28 } as CSSProperties} />
                    <div className={s.sep}>–</div>
                    <div className={`${s.digits} ${s.count}`} style={{ "--to": 24 } as CSSProperties} />
                  </div>
                  <p className={s.yourcall}>Example pick. Winner and final score.</p>
                </div>
                <div className={s.perf} />
                <div className={s.slipFoot}>
                  <span className={s.lock}>Locks 15 min after kickoff</span>
                </div>
                <div className={`${s.stamp} ${s.cond}`}>+{SCORING.perfect}<small>Perfect call</small></div>
              </div>
              <div className={`${s.chip} ${s.chipA}`}>
                <em>Weekly leaderboard</em>
                Maya T. · #1 · {PEOPLE[0].p} pts
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className={s.ticker} aria-hidden>
        <div className={s.tickTrack}>
          {[0, 1].map((k) => (
            <div key={k} style={{ display: "flex" }}>
              {TICKER.map((t) => (<span key={t + k}>{t}<i> &nbsp;🏈&nbsp; </i></span>))}
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className={`${s.sec} ${s.paper}`}>
        <div className={s.wrap}>
          <h2 className={s.secTitle}>Four steps to game day</h2>
          <p className={s.secLede}>From setup to a finished leaderboard in about the time it takes the teams to warm up.</p>
          <ol className={s.steps} style={{ listStyle: "none", padding: 0 }}>
            {STEPS.map((x, i) => (
              <li key={x.t} className={s.step}>
                <div className={s.stepN}>{i + 1}</div>
                <h3>{x.t}</h3>
                <p>{x.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SCORING */}
      <section className={`${s.sec} ${s.night}`}>
        <div className={s.wrap}>
          <div className={s.scoreGrid}>
            <div>
              <div className={s.big}>{SCORING.perfect}</div>
              <div className={s.bigCap}>points for a perfect call</div>
              <p style={{ color: "#b9c4ee", lineHeight: 1.6, marginTop: 14, maxWidth: "26em" }}>
                Get the winner, then chase the bonus for the score. Every game stays interesting until the final whistle.
              </p>
            </div>
            <div className={s.rows}>
              <div className={`${s.row} ${s.rowPerfect}`}>
                <span>Perfect call</span>
                <div className={s.track}><div className={s.fillB} style={bar(SCORING.winner)} /><div className={s.fillG} style={bar(SCORING.bothExact)} /></div>
                <span className={s.val}>{SCORING.perfect}</span>
              </div>
              {[
                ["Correct winner", SCORING.winner, s.fillB],
                ["Both scores exact", SCORING.bothExact, s.fillG],
                ["One score exact", SCORING.oneExact, s.fillS],
                ["Off by 1 or 2 total", SCORING.closeNear, s.fillS],
                ["Off by 3 to 5 total", SCORING.closeFar, s.fillS],
              ].map(([k, v, f]) => (
                <div key={k as string} className={s.row}>
                  <span>{k as string}</span>
                  <div className={s.track}><div className={f as string} style={bar(v as number)} /></div>
                  <span className={s.val}>+{v as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={`${s.sec} ${s.paper}`}>
        <div className={s.wrap}>
          <h2 className={s.secTitle}>Built for bragging rights</h2>
          <p className={s.secLede}>Everything a group needs to turn a game into a season-long rivalry.</p>
          <div className={s.bento}>
            <div className={`${s.card} ${s.b3}`}>
              <h3>Weekly and season leaderboards</h3>
              <p>Points roll up automatically. Players chase the weekly crown and the season title.</p>
              <div className={s.lb} aria-hidden>
                {PEOPLE.map((p, i) => (
                  <div key={p.n} className={s.lbRow}>
                    <span className={s.rank}>{i + 1}</span>
                    <span className={s.av} style={{ background: p.bg }}>{p.n.split(" ").map((w) => w[0]).join("")}</span>
                    {p.n}
                    <span className={s.pts}>{p.p}</span>
                  </div>
                ))}
              </div>
              <span className={s.exLabel}>Example leaderboard</span>
            </div>

            <div className={`${s.card} ${s.b3}`}>
              <h3>Crowd picks, ready to share</h3>
              <p>Once enough people have picked, see how the crowd is leaning and share a graphic of it.</p>
              <div className={s.split} aria-hidden>
                <span style={{ width: "62%", background: "#1b4fe4" }}>Eagles 62%</span>
                <span style={{ width: "38%", background: "#ffc531", color: "#0a0f2c" }}>38%</span>
              </div>
              <div className={s.tiles} aria-hidden>
                <div className={s.tile}><b>27–24</b><span>Most picked score</span></div>
                <div className={s.tile}><b>18</b><span>Picks so far</span></div>
              </div>
              <span className={s.exLabel}>Example crowd stats</span>
            </div>

            <div className={`${s.card} ${s.cardNight} ${s.b2}`}>
              <h3>Fair by design</h3>
              <p>Picks stay open until 15 minutes after the start time, then lock for everyone.</p>
              <div className={s.clock} aria-hidden>14:59</div>
            </div>

            <div className={`${s.card} ${s.cardBlue} ${s.b2}`}>
              <h3>Private, invite-only games</h3>
              <p>Keep it to your group. Only people with your code can play.</p>
              <div className={s.code} aria-hidden>K7P 2QX</div>
            </div>

            <div className={`${s.card} ${s.b2}`}>
              <h3>Brackets and slates</h3>
              <p>Run a whole tournament or a full weekend of games, with one leaderboard across all of it.</p>
              <svg viewBox="0 0 220 110" width="100%" height="110" aria-hidden>
                <g fill="none" stroke="#1b4fe4" strokeWidth="3" strokeLinecap="round">
                  <path d="M10 14h46v28h46M10 42h46M10 70h46v-28M10 98h46V70h46" />
                  <path d="M102 42v28M102 56h50" stroke="#ffc531" />
                </g>
                <circle cx="168" cy="56" r="14" fill="#ffc531" />
                <text x="168" y="62" textAnchor="middle" fontFamily="var(--cond)" fontWeight="900" fontSize="18" fill="#0a0f2c">1</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* USES */}
      <section className={`${s.sec}`} style={{ background: "#fff" }}>
        <div className={s.wrap}>
          <h2 className={s.secTitle}>Who runs a game</h2>
          <p className={s.secLede}>If people care about the game, they will care about the call.</p>
          <div className={s.uses}>
            {USES.map((u) => (
              <div key={u.t} className={`${s.use} ${s[u.c]}`}>
                <div className={s.emoji} aria-hidden>{u.i}</div>
                <div>
                  <h3>{u.t}</h3>
                  <p style={{ marginTop: 10 }}>{u.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className={`${s.sec} ${s.paper}`}>
        <div className={s.wrap}>
          <h2 className={s.secTitle}>Pick your size</h2>
          <p className={s.secLede}>Players never pay. These prices are for the organizer only.</p>
          <div className={s.tickets}>
            <div className={`${s.tk} ${s.tkHot}`}>
              <span className={s.tkTag}>Start here</span>
              <h3>Single game</h3>
              <div className={s.price}>Free</div>
              <p>One every two weeks, open 24 hours. Perfect for trying it out.</p>
              <Link href="/predictions/new" className={s.tkBtn}>Start a free game</Link>
            </div>
            <div className={s.tk}>
              <h3>Private game</h3>
              <div className={s.price}>{money(BRACKET_PRICING.privateGameCents)}</div>
              <p>Invite-only with a join code. Invitees play free.</p>
              <Link href="/predictions/private/new" className={s.tkBtn}>Create a private game</Link>
            </div>
            <div className={s.tk}>
              <h3>Bracket</h3>
              <div className={s.price}>{money(BRACKET_PRICING.weeklyCents)}+</div>
              <p>Many games, one leaderboard. {BRACKET_PRICING.weeklyDays} days, or {money(BRACKET_PRICING.seasonCents)} for the whole season.</p>
              <Link href="/predictions/bracket/new" className={s.tkBtn}>Build a bracket</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={s.sec} style={{ background: "#fff", paddingTop: 80, paddingBottom: 80 }}>
        <div className={s.wrap}>
          <h2 className={s.secTitle}>Questions</h2>
          <div className={s.faq}>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section className={s.final}>
        <h2 className={s.finalH}>Call it.</h2>
        <p>Set up your first game in about a minute and send the link to your group.</p>
        <div className={s.ctaRow} style={{ justifyContent: "center" }}>
          <Link href="/predictions/new" className={s.btnGold}>Start a free game</Link>
          <Link href="/predictions/join" className={s.btnGhost}>I have a code</Link>
        </div>
        <p className={s.sponsor}>Want your brand on a game or a season? <Link href="/sponsor">Sponsor a game</Link>.</p>
      </section>
    </div>
  );
}
