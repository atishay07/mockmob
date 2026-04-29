import React from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { Icon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { DotPattern } from '@/components/ui/dot-pattern';

export const metadata = {
  title: 'Features | MockMob',
  description: 'Explore the powerful tools built for top percentile rankers on MockMob.',
};

export default function FeaturesPage() {
  const allFeatures = [
    { t: 'Community Mocks', d: 'Peer-built questions with votes, saves, and quality signals, so the best material rises and weak questions get pushed out.', icon: 'users', highlight: true },
    { t: 'Weakness Radar', d: 'Score movement, chapter gaps, consistency, completion rate, and premium advanced analysis in one place.', icon: 'radar' },
    { t: 'Live Leaderboards', d: 'Turn practice into pressure. Climb ranks as you solve, submit, and compete in focused mock sprints.', icon: 'trend' },
    { t: 'Saved Question Bank', d: 'Bookmark tough questions from Explore and build your personal revision stack for repeat practice.', icon: 'book' },
    { t: 'Exam Tracks', d: 'CUET-first pathways with subject, unit, chapter, and difficulty controls shaped around actual student workflows.', icon: 'route' },
    { t: 'AI Admission Compass', d: 'Premium users unlock a DU college predictor with mock CUET score bands, category-aware targets, and course-subject eligibility checks.', icon: 'target', highlight: true },
    { t: 'Premium Speed Layer', d: 'Unlock unlimited mocks, advanced Radar, targeted difficulty, and faster high-intent practice loops.', icon: 'zap' },
  ];
  const proof = [
    ['Solve', 'Mock tests, chapter drills, and curated feeds'],
    ['Signal', 'Votes, saves, skips, and progress analytics'],
    ['Improve', 'Next moves, weak chapters, and premium recipes'],
  ];

  return (
    <div className="view">
      <NavBar />
      
      {/* HEADER */}
      <section className="px-5 pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(210,240,0,0.07)_0%,transparent_48%)] pointer-events-none" />
        <DotPattern width={26} height={26} cx={1} cy={1} cr={1.2} className="text-volt/20 opacity-40" glow={true} />
        <div className="container-narrow text-center relative z-10">
          <div className="eyebrow mb-4">{'// The Arsenal'}</div>
          <h1 className="display-lg mb-6">Every feature exists to move your <span className="text-volt italic">score faster.</span></h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
            MockMob is not a notes app. It is a practice engine: find the right questions, save the painful ones, get the signal, and come back sharper.
          </p>
        </div>
      </section>

      <section className="px-5 mb-10">
        <div className="container-std">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {proof.map(([title, body], index) => (
              <div key={title} className="glass p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-volt text-black flex items-center justify-center font-display font-bold shrink-0">{index + 1}</div>
                <div>
                  <h2 className="heading text-lg mb-1">{title}</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DETAILED GRID */}
      <section className="px-5 mb-20 relative">
        <div className="container-std">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allFeatures.map((f, i) => (
              <div key={i} className="glass p-6 md:p-8 relative overflow-hidden group md:min-h-[260px]" style={{ borderColor: f.highlight ? 'rgba(210,240,0,0.2)' : 'rgba(255,255,255,0.08)' }}>
                <div
                  className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                >
                  <DotPattern width={24} height={24} cx={1} cy={1} cr={1.5} className={f.highlight ? "text-volt/30" : "text-white/20"} glow={true} style={{ maskImage: 'radial-gradient(ellipse at center, white, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, white, transparent 70%)' }} />
                </div>
                
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500 shadow-lg" style={{ background: f.highlight ? 'var(--volt)' : 'rgba(255,255,255,0.05)', color: f.highlight ? '#000' : '#a1a1aa' }}>
                    <Icon name={f.icon} style={{ width: '24px', height: '24px' }} />
                  </div>
                  <h3 className="heading text-xl mb-3">{f.t}</h3>
                  <p className="text-zinc-400 leading-relaxed text-sm">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 mb-28">
        <div className="container-std">
          <div className="glass premium-feature-card p-5 md:p-6 grid grid-cols-1 lg:grid-cols-[minmax(360px,0.95fr)_minmax(0,1fr)] gap-6 items-stretch relative overflow-hidden border-volt/20">
            <DotPattern width={22} height={22} cx={1} cy={1} cr={1.2} className="text-volt/20 opacity-45" glow={true} style={{ maskImage: 'radial-gradient(ellipse at right, white, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at right, white, transparent 70%)' }} />
            <div className="relative z-10 feature-compass-shot">
              <div className="shot-top">
                <div>
                  <div className="mono-label">Admission Compass</div>
                  <div className="shot-score">872<span>/1000</span></div>
                </div>
                <span className="pill volt">High chance · 850-1000</span>
              </div>
              <div className="shot-bars">
                {['Accountancy', 'Economics', 'Maths', 'English', 'Business'].map((item, index) => (
                  <div key={item}>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span>{item}</span>
                      <span>{[184, 172, 166, 178, 172][index]}/200</span>
                    </div>
                    <div className="bar"><div className="fill fill-volt" style={{ width: `${[92, 86, 83, 89, 86][index]}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="shot-insights">
                <div>
                  <span>Eligibility</span>
                  <strong>5/5 subjects fit</strong>
                </div>
                <div>
                  <span>Next move</span>
                  <strong>Attack Economics</strong>
                </div>
              </div>
              <div className="shot-list">
                {[
                  ['SRCC', 'B.Com (Hons)', 'Aspirational'],
                  ['Hansraj', 'Economics', 'Moderate'],
                  ['Venky', 'B.Com (Hons)', 'High'],
                ].map(([college, course, chance]) => (
                  <div key={`${college}-${course}`} className="shot-row">
                    <div>
                      <b>{college}</b>
                      <span>{course}</span>
                    </div>
                    <em>{chance}</em>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative z-10 premium-copy">
              <div className="eyebrow mb-3">{'// Premium loop'}</div>
              <h2 className="display-md mb-3">Premium turns practice into admission intelligence.</h2>
              <p className="text-zinc-400 leading-relaxed max-w-xl">
                Unlimited mocks, advanced Radar, AI analysis, targeted difficulty, and Admission Compass help serious students see the gap between their current score and likely DU college-course options.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['Mock CUET score', 'DU college matching', 'Course eligibility', 'AI improvement moves'].map((item) => (
                  <span key={item} className="pill volt">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 mb-24 relative py-12 text-center">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(210,240,0,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="display-md mb-4">Ready to test these features?</h2>
          <p className="text-zinc-400 mb-8 max-w-sm mx-auto">Create a free account and start building your question history today.</p>
          <Link href="/signup">
            <Button variant="volt" size="lg">Join the Mob <Icon name="arrow" /></Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
      <style>{`
        .premium-feature-card {
          min-height: 0;
        }
        .premium-copy {
          align-self: center;
          padding: clamp(4px, 1vw, 14px);
        }
        .feature-compass-shot {
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 14px;
          background: rgba(0,0,0,.34);
          padding: 18px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .shot-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .shot-score {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: clamp(42px, 6vw, 68px);
          line-height: .9;
          color: var(--volt);
          font-variant-numeric: tabular-nums;
        }
        .shot-score span {
          color: #71717a;
          font-size: 18px;
        }
        .shot-bars {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .shot-insights {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .shot-insights div {
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          background: rgba(255,255,255,.025);
          padding: 10px;
        }
        .shot-insights span,
        .shot-insights strong {
          display: block;
        }
        .shot-insights span {
          color: #71717a;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .shot-insights strong {
          color: #f4f4f5;
          font-size: 12px;
          margin-top: 5px;
        }
        .shot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-top: 1px solid rgba(255,255,255,.06);
        }
        .shot-row b,
        .shot-row span {
          display: block;
        }
        .shot-row b {
          font-family: var(--font-display);
          color: #fff;
        }
        .shot-row span {
          color: #71717a;
          font-size: 12px;
        }
        .shot-row em {
          color: var(--volt);
          font-size: 12px;
          font-style: normal;
          font-weight: 800;
        }
        @media (max-width: 640px) {
          .shot-top,
          .shot-row {
            align-items: flex-start;
            flex-direction: column;
          }
          .shot-bars {
            grid-template-columns: 1fr;
          }
          .shot-insights {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
