import React from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { LandingActions } from '@/components/LandingActions';
import { Icon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';

// Magic UI components
import { MorphingText } from '@/components/ui/morphing-text';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ScrollVelocityContainer, ScrollVelocityRow } from '@/components/ui/scroll-based-velocity';
import { DotPattern } from '@/components/ui/dot-pattern';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';

export const metadata = seoMetadata({
  title: 'CUET Mock Tests & Practice Questions | MockMob',
  description:
    'Take CUET mock tests, practise peer-reviewed questions, track weak chapters, and prepare for CUET UG with MockMob.',
  path: '/',
});

export default function LandingPage() {
  const stats = [
    { v: 1000, l: 'Active Mobbers', i: 'users', plus: true },
    { v: 10000, l: 'Questions Live', i: 'book', plus: true },
    { v: 7, l: 'Exam tracks', i: 'route', plus: true },
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

  const faqs = [
    {
      question: 'Can I take a CUET mock test free on MockMob?',
      answer:
        'Yes. MockMob lets students start with free CUET mock practice and upgrade when they need unlimited mocks, deeper analytics, and Admission Compass.',
    },
    {
      question: 'Does MockMob include CUET previous year questions?',
      answer:
        'MockMob is built around CUET-style practice, previous year question routines, chapter drills, and community-verified questions for exam preparation.',
    },
    {
      question: 'Is MockMob affiliated with NTA?',
      answer:
        'No. MockMob is an independent exam preparation platform and is not affiliated with NTA, DU, CUET, or any official exam body.',
    },
  ];

  return (
    <div className="view">
      <JsonLd id="home-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }])} />
      <JsonLd id="home-faq-json-ld" data={faqJsonLd(faqs)} />
      <JsonLd
        id="home-course-json-ld"
        data={courseJsonLd({
          name: 'CUET Mock Tests and Practice Questions',
          description: 'CUET UG preparation with free mock tests, online practice questions, analytics, and admission planning.',
          path: '/',
        })}
      />
      <NavBar />
      
      {/* HERO */}
      <section style={{ paddingTop: '120px', paddingBottom: '60px' }} className="px-5 relative overflow-hidden">
        {/* Interactive Grid Background */}
        <InteractiveGridPattern 
          width={40} 
          height={40} 
          squares={[36, 28]} 
          className="opacity-[0.15] landing-grid-pattern"
          squaresClassName="hover:fill-volt/20"
        />

        <div className="container-wide text-center relative z-10">
          <Link href="/signup" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/25 mb-7 no-underline" style={{ background: 'rgba(248,113,113,0.04)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-slow" style={{ boxShadow: '0 0 8px rgba(248,113,113,.9)' }}></span>
            <span className="mono-label" style={{ color: 'var(--volt)' }}>Now live — CUET &apos;26 Mock Sprint</span>
            <Icon name="arrow" style={{ color: 'var(--volt)', width: '11px', height: '11px' }} />
          </Link>
          
          <h1 className="display-xl mb-2 text-white">
            Stop grinding alone.<br />
            Rank up with the
          </h1>
          <MorphingText texts={["mob.", "best.", "top 1%."]} className="text-volt italic h-[80px] md:h-[120px]" />
          
          <p className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto mb-8 mt-4" style={{ lineHeight: 1.6 }}>
            India&apos;s first community-built mock test platform. Take peer-verified mocks for <span className="text-volt font-semibold">CUET, JEE, NEET, UPSC, CAT, GATE &amp; SSC</span>. Compete live. Climb boards. Crack exams.
          </p>
          <LandingActions mode="hero" />
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
                      <NumberTicker value={s.v} />
                      {s.plus && '+'}
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
          <ScrollVelocityRow baseVelocity={1.6} direction={1} scrollReactivity={false}>
            CUET <span className="opacity-15 mx-4">—</span> JEE <span className="opacity-15 mx-4">—</span> NEET <span className="opacity-15 mx-4">—</span> UPSC <span className="opacity-15 mx-4">—</span> CAT <span className="opacity-15 mx-4">—</span> GATE <span className="opacity-15 mx-4">—</span> SSC <span className="opacity-15 mx-4">—</span> CLAT <span className="opacity-15 mx-4">—</span> NDA <span className="opacity-15 mx-4">—</span> 
          </ScrollVelocityRow>
        </ScrollVelocityContainer>
      </div>

      {/* HOW IT WORKS */}
      <section className="px-5 mb-24">
        <div className="container-std">
          <div className="text-center mb-12">
            <div className="eyebrow mb-3">{'// Workflow'}</div>
            <h2 className="display-lg">How MockMob <span className="text-volt" style={{ fontStyle: 'italic' }}>works.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-8 text-center relative hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-volt font-display font-bold text-xl border border-white/10">1</div>
              <h3 className="heading text-xl mb-3">Pick your target</h3>
              <p className="text-zinc-400 text-sm">Select your exam and chapters. We curate a custom mock based on what you actually need to study today.</p>
            </div>
            <div className="glass p-8 text-center relative hover:-translate-y-1 transition-transform border-volt/20 bg-[rgba(210,240,0,0.03)]">
              <div className="w-12 h-12 bg-volt rounded-full flex items-center justify-center mx-auto mb-6 text-black font-display font-bold text-xl shadow-[0_0_20px_rgba(210,240,0,0.3)]">2</div>
              <h3 className="heading text-xl mb-3 text-volt">Enter the Sprint</h3>
              <p className="text-zinc-400 text-sm">Solve peer-reviewed questions in a strict timed environment. Feel the exact pressure of the real exam.</p>
            </div>
            <div className="glass p-8 text-center relative hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-volt font-display font-bold text-xl border border-white/10">3</div>
              <h3 className="heading text-xl mb-3">Analyze & Climb</h3>
              <p className="text-zinc-400 text-sm">Review your trap patterns with the AI Radar and watch your global rank jump on the live leaderboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="px-5 mb-24 relative overflow-hidden py-10">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <DotPattern
            width={22}
            height={22}
            cx={1}
            cy={1}
            cr={1.2}
            className="text-volt/20"
            glow={true}
            style={{ maskImage: 'radial-gradient(ellipse at center, white, transparent 68%)', WebkitMaskImage: 'radial-gradient(ellipse at center, white, transparent 68%)' }}
          />
        </div>
        <div className="container-std">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 relative z-10">
            <div>
              <div className="eyebrow mb-3">{'// Why MockMob'}</div>
              <h2 className="display-lg">Built for the <span className="text-volt" style={{ fontStyle: 'italic' }}>top 1%.</span></h2>
              <p className="text-zinc-400 max-w-xl mt-3 leading-relaxed">
                A faster loop for serious students: solve, vote, save, diagnose, and return to the exact chapters that move the score.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
              {[
                ['1 tap', 'save weak questions'],
                ['5 min', 'chapter drills'],
                ['24/7', 'live radar'],
              ].map(([value, label]) => (
                <div key={label} className="glass px-3 py-3 text-center min-w-0">
                  <div className="heading text-volt text-xl">{value}</div>
                  <div className="mono-label !tracking-[0.08em] leading-snug whitespace-normal break-words">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
            {features.map((f, i) => (
              <div
                key={i}
                className={`glass p-6 md:p-8 ${f.span} relative overflow-hidden group md:min-h-[280px]`}
                style={{
                  background: f.hero ? 'rgba(210,240,0,0.02)' : 'rgba(255,255,255,0.015)',
                  borderColor: f.hero ? 'rgba(210,240,0,0.2)' : 'rgba(255,255,255,0.08)',
                }}
              >
                {/* Dot pattern is decorative; force absolute positioning so it can't
                    grow as a flex/block sibling and steal vertical space (the
                    `.glass > *` rule otherwise reverts it to position:relative). */}
                <div
                  className="pointer-events-none opacity-[0.35] group-hover:opacity-100 transition-opacity duration-700"
                  style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                >
                  <DotPattern width={24} height={24} cx={1} cy={1} cr={1.5} className={f.hero ? "text-volt/30" : "text-white/20"} glow={true} style={{ maskImage: 'radial-gradient(ellipse at top left, white, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at top left, white, transparent 70%)' }} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500" style={{ background: f.hero ? 'var(--volt)' : 'rgba(255,255,255,0.05)', color: f.hero ? '#000' : '#a1a1aa' }}>
                      <Icon name={f.icon} style={{ width: '20px', height: '20px' }} />
                    </div>
                    {f.tag && <span className="pill volt">{f.tag}</span>}
                  </div>
                  <h3 className="heading text-xl md:text-2xl mb-2 md:mb-3">{f.t}</h3>
                  <p className="text-zinc-400 text-sm md:text-base leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DU COMPASS */}
      <section className="px-5 mb-24">
        <div className="container-std">
          <div className="compass-card glass relative overflow-hidden border-volt/20">
            <DotPattern
              width={22}
              height={22}
              cx={1}
              cy={1}
              cr={1.2}
              className="text-volt/20 opacity-40"
              glow={true}
              style={{ maskImage: 'radial-gradient(ellipse at top left, white, transparent 65%)', WebkitMaskImage: 'radial-gradient(ellipse at top left, white, transparent 65%)' }}
            />
            <div className="compass-grid">
              <div className="compass-copy">
                <div className="eyebrow mb-3">{'// DU Compass · AI guidance'}</div>
                <h2 className="display-md mb-3 leading-[1.05]">
                  DU Compass,<br className="hidden sm:block" /> powered by <span className="text-volt italic">AI.</span>
                </h2>
                <p className="text-zinc-400 leading-relaxed">
                  A guidance layer for CUET-based admissions. Compass reads your mock score, selected subjects, and category to map realistic Delhi University college and course options, with the marks gap and the next move spelled out.
                </p>
                <ul className="compass-features">
                  {[
                    ['Score band predictor', 'Mock scores into CUET confidence tiers.'],
                    ['Course-subject fit', 'DU eligibility checked before shortlist.'],
                    ['Category-aware targets', 'Cutoffs adjusted by category and campus.'],
                    ['Next-move analysis', 'The subject that moves rank the fastest.'],
                  ].map(([title, body]) => (
                    <li key={title}>
                      <span className="compass-feature-dot" aria-hidden="true" />
                      <div>
                        <div className="compass-feature-title">{title}</div>
                        <div className="compass-feature-body">{body}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link href="/features" className="compass-cta">
                  See how Compass works
                  <Icon name="arrow" style={{ width: '14px', height: '14px' }} />
                </Link>
              </div>
              <div className="compass-shot" aria-label="DU Compass preview">
                <div className="shot-top">
                  <div>
                    <div className="mono-label">Mock CUET score</div>
                    <div className="shot-score">872<span>/1000</span></div>
                  </div>
                  <span className="pill volt shot-band">High · 850-1000</span>
                </div>
                <div className="shot-bars">
                  {[
                    ['Economics', 178],
                    ['Accountancy', 184],
                    ['English', 178],
                  ].map(([subject, marks]) => (
                    <div key={subject}>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                        <span>{subject}</span>
                        <span className="font-mono tabular-nums">{marks}/200</span>
                      </div>
                      <div className="bar"><div className="fill fill-volt" style={{ width: `${Math.round((marks / 200) * 100)}%` }} /></div>
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
                    <strong>Push Maths +12</strong>
                  </div>
                </div>
                <div className="shot-list">
                  {[
                    ['SRCC', 'B.Com (Hons)', 'Aspirational'],
                    ['Hansraj', 'Economics (Hons)', 'Moderate'],
                    ['Sri Venkateswara', 'B.Com (Hons)', 'High'],
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
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-5 mb-24">
        <div className="container-std">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-10 gap-6 text-center md:text-left">
            <div>
              <div className="eyebrow mb-3">{'// Wall of love'}</div>
              <h2 className="display-lg">The mob <span className="text-volt" style={{ fontStyle: 'italic' }}>speaks.</span></h2>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button type="button" aria-label="Previous testimonial" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5"><Icon name="chevL" /></button>
              <button type="button" aria-label="Next testimonial" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5"><Icon name="chevR" /></button>
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
      <section className="px-5 mb-24 relative py-10 md:py-16 text-center">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(210,240,0,0.08)_0%,transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-volt rounded-xl mx-auto mb-5 flex items-center justify-center text-black shadow-[0_0_30px_rgba(210,240,0,0.3)]">
            <Icon name="zap" style={{ width: '22px', height: '22px' }} />
          </div>
          <h2 className="display-lg mb-3">Stop reading. Start solving.</h2>
          <p className="text-zinc-400 mb-8 max-w-sm mx-auto text-sm md:text-base">The next topper is already on Question 42 today. What are you waiting for?</p>
          <LandingActions mode="primary" />
        </div>
      </section>

      <section className="px-5 mb-24">
        <div className="container-narrow">
          <div className="text-center mb-8">
            <div className="eyebrow mb-3">{'// CUET FAQ'}</div>
            <h2 className="display-md">Quick answers before you start.</h2>
          </div>
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="glass p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none font-display text-lg font-bold text-white">
                  {faq.question}
                </summary>
                <p className="pt-3 text-sm leading-relaxed text-zinc-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
      <style>{`
        .compass-card {
          padding: clamp(20px, 3vw, 32px);
          background:
            radial-gradient(circle at 0% 0%, rgba(210,240,0,0.06), transparent 55%),
            rgba(255,255,255,0.015);
        }
        .compass-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr;
          gap: 22px;
          align-items: start;
        }
        @media (min-width: 960px) {
          .compass-grid {
            grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
            gap: 36px;
          }
        }
        .compass-copy {
          padding: 4px 2px;
          max-width: 560px;
        }
        .compass-features {
          margin-top: 22px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          padding: 0;
          list-style: none;
        }
        @media (min-width: 480px) {
          .compass-features {
            grid-template-columns: 1fr 1fr;
            gap: 14px 22px;
          }
        }
        .compass-features li {
          display: flex;
          align-items: flex-start;
          gap: 11px;
        }
        .compass-feature-dot {
          margin-top: 7px;
          width: 6px;
          height: 6px;
          flex-shrink: 0;
          border-radius: 999px;
          background: var(--volt);
          box-shadow: 0 0 8px rgba(210,240,0,.7);
        }
        .compass-feature-title {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 800;
          color: #fff;
          line-height: 1.3;
        }
        .compass-feature-body {
          color: #a1a1aa;
          font-size: 12.5px;
          line-height: 1.45;
          margin-top: 2px;
        }
        .compass-cta {
          margin-top: 24px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--volt);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 13.5px;
          letter-spacing: .01em;
          transition: gap .2s cubic-bezier(.2,.8,.2,1);
        }
        .compass-cta:hover { gap: 12px; }
        .compass-shot {
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01)),
            rgba(0,0,0,.32);
          padding: 18px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
          width: 100%;
        }
        @media (min-width: 960px) {
          .compass-shot {
            position: sticky;
            top: 96px;
            padding: 20px;
          }
        }
        .compass-shot .shot-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .compass-shot .shot-band {
          flex-shrink: 0;
          align-self: center;
          font-size: 10px;
          letter-spacing: .04em;
        }
        .compass-shot .shot-score {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: clamp(40px, 5.4vw, 56px);
          line-height: .92;
          color: var(--volt);
          font-variant-numeric: tabular-nums;
          margin-top: 2px;
        }
        .compass-shot .shot-score span {
          color: #71717a;
          font-size: 16px;
          font-weight: 700;
        }
        .compass-shot .shot-bars {
          display: grid;
          grid-template-columns: 1fr;
          gap: 9px;
          margin-bottom: 14px;
        }
        .compass-shot .shot-insights {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 4px;
        }
        .compass-shot .shot-insights div {
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          background: rgba(255,255,255,.025);
          padding: 9px 10px;
        }
        .compass-shot .shot-insights span,
        .compass-shot .shot-insights strong {
          display: block;
        }
        .compass-shot .shot-insights span {
          color: #71717a;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .compass-shot .shot-insights strong {
          color: #f4f4f5;
          font-size: 12px;
          margin-top: 4px;
        }
        .compass-shot .shot-list {
          margin-top: 6px;
        }
        .compass-shot .shot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          border-top: 1px solid rgba(255,255,255,.06);
        }
        .compass-shot .shot-row b,
        .compass-shot .shot-row span {
          display: block;
        }
        .compass-shot .shot-row b {
          font-family: var(--font-display);
          color: #fff;
          font-size: 14px;
        }
        .compass-shot .shot-row span {
          color: #71717a;
          font-size: 11.5px;
          margin-top: 1px;
        }
        .compass-shot .shot-row em {
          color: var(--volt);
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
          font-family: var(--font-mono);
          letter-spacing: .04em;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        @media (max-width: 380px) {
          .compass-shot .shot-top {
            flex-direction: column;
            align-items: flex-start;
          }
          .compass-shot .shot-band {
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
