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
              <div key={i} className="glass p-8 relative overflow-hidden group flex flex-col justify-between" style={{ minHeight: '280px', borderColor: f.highlight ? 'rgba(210,240,0,0.2)' : 'rgba(255,255,255,0.08)' }}>
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-0">
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
          <div className="glass p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center relative overflow-hidden border-volt/20">
            <DotPattern width={22} height={22} cx={1} cy={1} cr={1.2} className="text-volt/20 opacity-45" glow={true} style={{ maskImage: 'radial-gradient(ellipse at right, white, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at right, white, transparent 70%)' }} />
            <div className="relative z-10">
              <div className="eyebrow mb-3">{'// Premium loop'}</div>
              <h2 className="display-md mb-3">Free gets you started. Premium makes practice aggressive.</h2>
              <p className="text-zinc-400 leading-relaxed max-w-xl">
                Unlimited mocks, advanced Radar, targeted difficulty, and premium practice recipes help serious students compress the time between mistake and improvement.
              </p>
            </div>
            <div className="relative z-10 grid grid-cols-2 gap-3">
              {['Unlimited mocks', 'Advanced Radar', 'Difficulty targeting', 'Saved revision stack'].map((item) => (
                <div key={item} className="glass p-4 min-h-[92px] flex flex-col justify-between">
                  <Icon name="check" style={{ color: 'var(--volt)', width: '18px', height: '18px' }} />
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
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
    </div>
  );
}
