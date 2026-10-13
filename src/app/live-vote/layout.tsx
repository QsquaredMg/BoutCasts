import type { Metadata } from "next";
import LvTabs from "@/components/LvTabs";
import "./lv-theme.css";

export const metadata: Metadata = { title: "Live Vote", description: "Run a live vote for class elections, halftime polls, talent shows and awards — one vote per person, results in real time. Free to start." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lv">
      <header className="lv-band">
        <div className="lv-band-in">
          <div className="lv-brand">
            <span className="lv-mark">Live <i>Vote</i></span>
            <span className="lv-tag">Every vote counted in the open. One vote per person.</span>
          </div>
          <LvTabs />
        </div>
      </header>
      <div className="lv-gold-rule" />
      {children}
    </div>
  );
}
