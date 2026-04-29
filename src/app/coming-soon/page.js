import React from "react";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui/Icons";
import { ComingSoonClient, ComingSoonCountdown } from "./ComingSoonClient";

export const metadata = {
  title: "Coming Soon | MockMob",
  description: "MockMob is opening soon.",
  robots: {
    index: false,
    follow: true,
  },
};

const tracks = ["CUET 2026", "JEE", "NEET", "UPSC", "CAT", "GATE", "SSC", "CLAT"];
const pulses = ["CUET Sprint", "Peer questions", "Rank boards", "Weakness radar"];

export default function ComingSoonPage() {
  return (
    <main className="coming-soon-page">
      <div className="coming-soon-grid" />
      <div className="coming-soon-scan" />

      <header className="coming-soon-header">
        <Logo />
        <span className="coming-soon-pill">
          <span />
          CUET beta
        </span>
      </header>

      <section className="coming-soon-shell">
        <div className="coming-soon-copy">
          <p className="eyebrow no-dot coming-soon-eyebrow">CUET 2026 first</p>
          <h1>
            MockMob for CUET
            <span> goes live tomorrow.</span>
          </h1>
          <p className="coming-soon-lede">
            We are opening the arena with CUET 2026 mocks first. JEE, NEET, UPSC and the rest
            are on the roadmap, but tomorrow belongs to CUET.
          </p>

          <ComingSoonCountdown />
          <ComingSoonClient />

          <div className="coming-soon-track" aria-label="Supported exams">
            {tracks.map((track) => (
              <span key={track} className={track === "CUET 2026" ? "is-live" : undefined}>
                {track}
              </span>
            ))}
          </div>
        </div>

        <div className="coming-soon-panel" aria-hidden="true">
          <div className="coming-soon-panel-top">
            <span>CUET Sprint</span>
            <span>Launch T-1 day</span>
          </div>
          <div className="coming-soon-radar">
            <div className="coming-soon-radar-ring ring-one" />
            <div className="coming-soon-radar-ring ring-two" />
            <div className="coming-soon-radar-ring ring-three" />
            <div className="coming-soon-sweep" />
            <Icon name="zap" className="coming-soon-radar-bolt" />
          </div>
          <div className="coming-soon-metrics">
            {pulses.map((pulse, index) => (
              <div key={pulse} style={{ "--delay": `${index * 0.18}s` }}>
                <span>{pulse}</span>
                <strong>{index === 0 ? "2026" : index === 1 ? "7.4k" : index === 2 ? "Live" : "AI"}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="coming-soon-marquee">
        <div>
          {[...tracks, ...tracks].map((track, index) => (
            <span key={`${track}-${index}`}>{track === "CUET 2026" ? "CUET 2026 live tomorrow" : `${track} next`}</span>
          ))}
        </div>
      </div>
    </main>
  );
}
