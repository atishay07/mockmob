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
    { t: 'Community Mocks', d: 'Thousands of high-quality questions created, reviewed, and battle-tested by toppers. Skip the outdated PDFs and solve what matters.', icon: 'users', highlight: true },
    { t: 'AI Weakness Radar', d: 'Our engine tracks your performance across subjects, identifying your exact weak points and trap patterns to fix before the exam.', icon: 'radar' },
    { t: 'Live Leaderboards', d: 'Compete in real-time. Watch your rank jump up the global charts as you out-solve your peers during mock sprints.', icon: 'trend' },
    { t: 'Discord-Style Rooms', d: 'Join voice channels and study rooms. Solve doubts, stay accountable, and prepare with the best.', icon: 'msg' },
    { t: 'Exam Tracks', d: 'Specialized paths for CUET, JEE, NEET, UPSC, and more. Get tailored question sets matching exact exam patterns.', icon: 'route' },
    { t: 'Instant Analytics', d: 'Get actionable insights right after submitting. Compare time-taken-per-question against the top 1%.', icon: 'zap' },
  ];

  return (
    <div className="view">
      <NavBar />
      
      {/* HEADER */}
      <section className="px-5 pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(210,240,0,0.05)_0%,transparent_50%)] pointer-events-none" />
        <div className="container-narrow text-center relative z-10">
          <div className="eyebrow mb-4">{'// The Arsenal'}</div>
          <h1 className="display-lg mb-6">Built to give you an <span className="text-volt italic">unfair advantage.</span></h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
            Stop guessing your prep level. We provide the tools, the analytics, and the community to guarantee your rank jump.
          </p>
        </div>
      </section>

      {/* DETAILED GRID */}
      <section className="px-5 mb-32 relative">
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

      {/* CTA */}
      <section className="px-5 mb-24 relative py-12 text-center">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(210,240,0,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="display-md mb-4">Ready to test these features?</h2>
          <p className="text-zinc-400 mb-8 max-w-sm mx-auto">Create a free account in 30 seconds and start your mock sprint.</p>
          <Link href="/signup">
            <Button variant="volt" size="lg">Join the Mob <Icon name="arrow" /></Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
