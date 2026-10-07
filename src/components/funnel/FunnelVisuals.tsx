import type { CSSProperties } from "react";
import { fx as s } from "./Funnel";

// Hero illustrations for the funnels. All sample data: the names, scores and
// amounts are examples, labeled as such, not real results.

const tilt = (deg: number) => ({ "--tilt": `${deg}deg` }) as CSSProperties;

export function BracketVisual() {
  return (
    <div className={s.vCard} style={tilt(-2.5)}>
      <div className={s.vBar}>
        <span>Sample bracket</span>
        <span className={s.vLive}>
          <span className={s.dot} /> Round 2 voting
        </span>
      </div>
      <div className={s.vBody}>
        <div className={s.brk}>
          <div className={s.brkCol}>
            <div className={`${s.slot} ${s.slotWin}`}>
              Crew One<small>64%</small>
              <div className={s.vbar}><i style={{ width: "64%" }} /></div>
            </div>
            <div className={s.slot}>
              Crew Two<small>36%</small>
              <div className={s.vbar}><i style={{ width: "36%", opacity: 0.4 }} /></div>
            </div>
            <div className={`${s.slot} ${s.slotWin}`}>
              Crew Three<small>58%</small>
              <div className={s.vbar}><i style={{ width: "58%" }} /></div>
            </div>
            <div className={s.slot}>
              Crew Four<small>42%</small>
              <div className={s.vbar}><i style={{ width: "42%", opacity: 0.4 }} /></div>
            </div>
          </div>
          <div className={`${s.brkCol} ${s.brkMid}`}>
            <div className={`${s.slot} ${s.slotWin}`}>
              Crew One<small>Live now</small>
              <div className={s.vbar}><i style={{ width: "52%" }} /></div>
            </div>
            <div className={s.slot}>
              Crew Three<small>Live now</small>
              <div className={s.vbar}><i style={{ width: "48%", opacity: 0.4 }} /></div>
            </div>
          </div>
          <div className={s.brkCol}>
            <div className={`${s.slot} ${s.slotChamp}`}>
              <span className={s.crown}>👑</span>
              <b>Champion</b>
              <small style={{ color: "#c9ccdd" }}>Decided by the crowd</small>
            </div>
          </div>
        </div>
      </div>
      <div className={s.vStamp}>
        <small>Winners advance</small>
        Automatically
      </div>
      <div className={`${s.vChip} ${s.vChipA}`}>
        <em>Entry link</em>
        boutcasts.com/c/…
      </div>
      <div className={`${s.vChip} ${s.vChipB}`}>
        <em>Entries approved</em>
        8 of 11
      </div>
    </div>
  );
}

export function ScorecardVisual() {
  const rows: [string, number][] = [
    ["Skill", 9],
    ["Creativity", 8],
    ["Performance", 9],
    ["Crowd appeal", 7],
  ];
  return (
    <div className={s.vCard} style={tilt(2)}>
      <div className={s.vBar}>
        <span>Sample showcase</span>
        <span className={s.vLive}>
          <span className={s.dot} /> Judges scoring
        </span>
      </div>
      <div className={s.vBody}>
        <div className={s.screen}>
          <div className={s.play} />
          <span className={s.screenTag}>Group 3 · starts 4:15</span>
        </div>
        <div className={s.crit}>
          {rows.map(([name, v]) => (
            <div key={name} className={s.critRow}>
              <span>{name}</span>
              <div className={s.critTrack}><i style={{ width: `${v * 10}%` }} /></div>
              <span className={s.critVal}>{v}</span>
            </div>
          ))}
        </div>
        <div className={s.judges}>
          <span className={s.av} style={{ background: "#7c3aed" }}>J1</span>
          <span className={s.av} style={{ background: "#0ea5a4" }}>J2</span>
          <span className={s.av} style={{ background: "#e11d48" }}>J3</span>
          <span style={{ marginLeft: 10 }}>3 judges · private score links</span>
        </div>
      </div>
      <div className={s.vStamp}>
        <small>Panel + crowd</small>
        Blended
      </div>
      <div className={`${s.vChip} ${s.vChipB}`}>
        <em>Scoring mode</em>
        Crowd 50 / Judges 50
      </div>
    </div>
  );
}

export function ReceiptVisual() {
  return (
    <div className={`${s.vCard} ${s.rcpt}`} style={tilt(-2)}>
      <div className={s.vBar}>
        <span>Sample paid bout</span>
        <span>Published terms</span>
      </div>
      <div className={s.vBody}>
        <div className={s.rcptRow}><span>Entry fee</span><b>$20</b></div>
        <div className={s.rcptRow}><span>Minimum entries</span><b>10</b></div>
        <div className={s.rcptRow}><span>BoutCasts fee</span><b>20%</b></div>
        <div className={s.rcptRow}><span>1st place prize</span><b>$100</b></div>
        <div className={s.rcptTotal}>
          <span style={{ fontWeight: 800, fontSize: ".85rem", color: "#6b738a" }}>If the minimum isn&apos;t met</span>
          <b>Full refund</b>
        </div>
        <div className={s.meter}><i /></div>
        <div className={s.meterCap}><span>7 entered</span><span>10 needed</span></div>
      </div>
      <div className={s.vStamp}>
        <small>Rules posted</small>
        Before you pay
      </div>
      <div className={`${s.vChip} ${s.vChipB}`}>
        <em>Payout order</em>
        Fee → prizes → organizer
      </div>
    </div>
  );
}

export function SponsorVisual() {
  return (
    <div className={s.vCard} style={tilt(2)}>
      <div className={s.vBar}>
        <span>Sample placement</span>
        <span>Your brand</span>
      </div>
      <div className={s.vBody}>
        <div className={s.ad}>
          <span className={s.adTag}>Ad · :15</span>
          <span className={s.adSkip}>Plays before clips</span>
          <div className={s.adBrand}>
            <small>Your brand here</small>
            Fresh. Local.
            <br />
            Yours.
          </div>
        </div>
        <div className={s.presented}>
          <div>
            <span>Presented by</span>
            Your Business Name
          </div>
          <div className={s.logoBox}>YB</div>
        </div>
        <div className={s.presented} style={{ background: "#fff8e1" }}>
          <div>
            <span>Monthly report</span>
            Votes, reach and views
          </div>
          <div className={s.logoBox} style={{ background: "#ffc531", color: "#0a0a12" }}>↗</div>
        </div>
      </div>
      <div className={s.vStamp}>
        <small>Seen by fans</small>
        At live events
      </div>
    </div>
  );
}

export function DebateVisual() {
  return (
    <div className={s.vCard} style={tilt(-2)}>
      <div className={s.vBar}>
        <span>&ldquo;Homework should be optional&rdquo;</span>
        <span className={s.vLive}>
          <span className={s.dot} /> Round 2
        </span>
      </div>
      <div className={s.vBody}>
        <div className={s.dSplit}>
          <div className={`${s.dSide} ${s.dFor} ${s.turn}`}>
            <div className={s.cam}>🎥</div>
            <b>For</b>
            <small>Speaking now</small>
          </div>
          <div className={`${s.dSide} ${s.dAgainst}`}>
            <div className={s.cam}>🎥</div>
            <b>Against</b>
            <small>Watched your video</small>
          </div>
        </div>
        <div className={s.dClock}>
          2:41
          <small>OF 3:00 MAX</small>
        </div>
        <div className={s.dTally}>
          <span style={{ width: "57%", background: "#1d4ed8" }}>57%</span>
          <span style={{ width: "43%", background: "#c23147" }}>43%</span>
        </div>
      </div>
      <div className={s.vStamp}>
        <small>Pick a side</small>
        Make your case
      </div>
      <div className={`${s.vChip} ${s.vChipA}`}>
        <em>Turn clock</em>
        Miss it, forfeit it
      </div>
    </div>
  );
}
