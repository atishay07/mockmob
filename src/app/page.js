import React from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { Icon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { MarketingFooter } from '@/components/MarketingFooter';

// Magic UI components
import { MorphingText } from '@/components/ui/morphing-text';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ScrollVelocityContainer, ScrollVelocityRow } from '@/components/ui/scroll-based-velocity';
import { DotPattern } from '@/components/ui/dot-pattern';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';

export default function LandingPage() {
  const stats = [
    { v: 48210, l: 'Active Mobbers', i: 'users' },
    { v: 100, l: 'Questions Live', i: 'book', plus: true },
    { v: 213, l: 'Avg Rank Jump', i: 'trend', plus: true },
    { v: 'LIVE', l: 'Mock Sprint', i: 'flame', live: true },
  ];
  
  const features = [
    { t: 'Community-built mocks', d: '10,000+ peer-crafted questions reviewed, rated, and battle-tested by toppers every single day. No dusty PDFs. No decade-old repeats.', tag: 'MOST LOVED', icon: 'users', span: 'md:col-span-8', hero: true },
    { t: 'AI weakness radar', d: 'Smart analytics pinpoint the exact chapter, topic & trap killing your score.', icon: 'radar', span: 'md:col-span-4', chart: true },
    { t: 'Discord-style study', d: 'Live voice rooms and real-time doubt solving. Study with your mob, stay accountable 24/7.', icon: 'msg', span: 'md:col-span-4' },
    { t: 'Exam-specific tracks', d: 'Tailored pathways for CUET, JEE, NEET, and UPSC. Not just tests — a roadmap to the rank.', icon: 'route', span: 'md:col-span-8', track: true },
  ];

  const testimonials = [
    { n: 'Aanya Kulkarni', r: 'CUET • AIR 42', q: 'I used to solve PYQs alone at 2 AM wondering if my speed was normal. MockMob showed me the mob was solving faster — and that pushed me to actually level up.' },
    { n: 'Rohit Mehta', r: 'JEE ADV • Rank 812', q: 'The speed of the interface is a game changer. It feels exactly like the NTA centre computers, minus the lag.' },
    { n: 'Sia Prajapati', r: 'NEET • AIR 1,204', q: 'The weakness radar caught that my time management was poor in Biology. Fixed it in 2 weeks. Scored 355/360.' },
  ];

  return (
    <div className="view">
      <NavBar />
      
      {/* HERO */}
      <section style={{ paddingTop: '120px', paddingBottom: '60px' }} className="px-5 relative overflow-hidden">
        {/* Interactive Grid Background */}
        <InteractiveGridPattern 
          width={40} 
          height={40} 
          squares={[32, 32]} 
          className="opacity-30 mix-blend-overlay"
          squaresClassName="hover:fill-volt/20"
        />

        <div className="container-wide text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-volt/20 mb-7" style={{ background: 'rgba(210,240,0,0.03)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-volt animate-pulse-slow" style={{ boxShadow: '0 0 8px var(--volt)' }}></span>
            <span className="mono-label" style={{ color: 'var(--volt)' }}>Now live — CUET &apos;26 Mock Sprint</span>
            <Icon name="arrow" style={{ color: 'var(--volt)', width: '11px', height: '11px' }} />
          </div>
          
          <h1 className="display-xl mb-2">
            Stop grinding alone.<br />
            Rank up with the
          </h1>
          <MorphingText texts={["mob.", "best.", "top 1%."]} className="text-volt italic h-[80px] md:h-[120px]" />
          
          <p className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto mb-8 mt-4" style={{ lineHeight: 1.6 }}>
            India&apos;s first community-built mock test platform. Take peer-verified mocks for <span className="text-volt font-semibold">CUET, JEE, NEET, UPSC, CAT, GATE &amp; SSC</span>. Compete live. Climb boards. Crack exams.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Link href="/signup">
              <Button variant="volt" size="lg">Start a free mock <Icon name="arrow" /></Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline" size="lg">Get Started <Icon name="arrow" /></Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg">View Pricing <Icon name="arrow" /></Button>
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <Icon name="spark" style={{ color: 'var(--volt)', width: '12px', height: '12px' }} />
            No credit card. No spam. Just vibes and verified mocks.
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="px-5 mb-20 relative z-10">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((s, i) => (
              <div key={i} className="glass p-5 flex flex-col items-center justify-center text-center" style={{ borderColor: s.live ? 'rgba(210,240,0,0.3)' : 'rgba(255,255,255,0.08)' }}>
                <div className="mb-2" style={{ color: s.live ? 'var(--volt)' : '#71717a' }}>
                  <Icon name={s.i} style={{ width: '20px', height: '20px' }} />
                </div>
                <div className="display-md mb-1" style={{ color: s.live ? 'var(--volt)' : '#fff' }}>
                  {typeof s.v === 'number' ? (
                    <>
                      {s.plus && '+'}
                      <NumberTicker value={s.v} />
                      {s.v === 100 && '+'}
                    </>
                  ) : (
                    s.v
                  )}
                </div>
                <div className="mono-label">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden bg-white/5 border-y border-white/5 mb-20 relative py-6">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10"></div>
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10"></div>
        <ScrollVelocityContainer className="font-display font-bold text-3xl md:text-5xl tracking-tight text-white/40">
          <ScrollVelocityRow baseVelocity={3} direction={1}>
            CUET <span className="opacity-15 mx-4">—</span> JEE <span className="opacity-15 mx-4">—</span> NEET <span className="opacity-15 mx-4">—</span> UPSC <span className="opacity-15 mx-4">—</span> CAT <span className="opacity-15 mx-4">—</span> GATE <span className="opacity-15 mx-4">—</span> SSC <span className="opacity-15 mx-4">—</span> CLAT <span className="opacity-15 mx-4">—</span> NDA <span className="opacity-15 mx-4">—</span> 
          </ScrollVelocityRow>
        </ScrollVelocityContainer>
      </div>

      {/* FEATURES BENTO */}
      <section className="px-5 mb-24">
        <div className="container-std">
          <div className="text-center mb-12">
            <div className="eyebrow mb-3">{'// Why MockMob'}</div>
            <h2 className="display-lg">Built for the <span className="text-volt" style={{ fontStyle: 'italic' }}>top 1%.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {features.map((f, i) => (
              <div key={i} className={`glass p-8 flex flex-col justify-between ${f.span}`} style={{ minHeight: '320px', background: f.hero ? 'rgba(210,240,0,0.02)' : 'rgba(255,255,255,0.015)', borderColor: f.hero ? 'rgba(210,240,0,0.2)' : 'rgba(255,255,255,0.08)' }}>
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: f.hero ? 'var(--volt)' : 'rgba(255,255,255,0.05)', color: f.hero ? '#000' : '#a1a1aa' }}>
                      <Icon name={f.icon} style={{ width: '22px', height: '22px' }} />
                    </div>
                    {f.tag && <span className="pill volt">{f.tag}</span>}
                  </div>
                  <h3 className="heading text-2xl mb-3">{f.t}</h3>
                  <p className="text-zinc-400 text-sm md:text-base leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-5 mb-24">
        <div className="container-std">
          <div className="flex flex-col md:flex-row items-end justify-between mb-10 gap-6">
            <div>
              <div className="eyebrow mb-3">{'// Wall of love'}</div>
              <h2 className="display-lg">The mob <span className="text-volt" style={{ fontStyle: 'italic' }}>speaks.</span></h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5"><Icon name="chevL" /></button>
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5"><Icon name="chevR" /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <div key={i} className="glass p-8 relative hover:scale-[1.02] transition-transform duration-300">
                <div className="text-volt mb-4 flex gap-1">
                  {[...Array(5)].map((_, j) => <Icon key={j} name="spark" style={{ width: '14px', height: '14px', fill: 'currentColor' }} />)}
                </div>
                <p className="text-base text-zinc-300 mb-8 italic">&ldquo;{t.q}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-volt to-zinc-500 flex items-center justify-center text-black font-bold font-display">{t.n.charAt(0)}</div>
                  <div>
                    <div className="font-display font-bold text-sm">{t.n}</div>
                    <div className="text-xs text-zinc-500">{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 mb-24 relative">
        <div className="container-narrow glass text-center overflow-hidden relative" style={{ padding: '80px 20px', background: 'linear-gradient(180deg, rgba(210,240,0,0.05) 0%, rgba(255,255,255,0.01) 100%)', borderColor: 'rgba(210,240,0,0.2)' }}>
          <DotPattern width={20} height={20} cx={1} cy={1} cr={1.5} className="opacity-40 text-volt/50" glow={true} />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-volt rounded-2xl mx-auto mb-6 flex items-center justify-center text-black shadow-[0_0_40px_rgba(210,240,0,0.4)]">
              <Icon name="zap" style={{ width: '28px', height: '28px' }} />
            </div>
            <h2 className="display-lg mb-4">Stop reading. Start solving.</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">The next CUET topper is already on Question 42 today. What are you waiting for?</p>
            <Link href="/signup">
              <Button variant="volt" size="lg" className="hover:scale-105 transition-transform">Join the Mob <Icon name="arrow" /></Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
