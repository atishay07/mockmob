import React from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { LandingActions } from '@/components/LandingActions';
import { Icon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { DynamicCompassPreview } from '@/components/landing/DynamicCompassPreview';
import { breadcrumbJsonLd, courseJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';

import { MorphingText } from '@/components/ui/morphing-text';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ScrollVelocityContainer, ScrollVelocityRow } from '@/components/ui/scroll-based-velocity';
import { DotPattern } from '@/components/ui/dot-pattern';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { PrepOSOrb } from '@/components/ui/PrepOSOrb';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

export const metadata = seoMetadata({
  title: 'CUET Mock Tests & Practice Questions | MockMob',
  description:
    'Take CUET mock tests, practise peer-reviewed questions, track weak chapters, and prepare for CUET UG with MockMob.',
  path: '/',
});

export default function LandingPage() {
  const valueTiles = [
    {
      label: 'CUET Practice Bank',
      copy: '10,000+ exam-style questions mapped to CUET patterns.',
      icon: 'book',
    },
    {
      label: 'Prep OS',
      copy: 'Mocks, weakness tracking, revision, and AI guidance in one loop.',
      icon: 'spark',
      accent: true,
    },
    {
      label: 'DU Compass',
      copy: 'Map scores to realistic DU course paths.',
      icon: 'route',
    },
    {
      label: 'AI Rival',
      copy: 'Timed benchmark battles to test speed and accuracy.',
      icon: 'flame',
    },
  ];

  const features = [
    { t: 'Community-built CUET mocks', d: '10,000+ peer-crafted questions reviewed, rated, and battle-tested by serious CUET aspirants every day. No dusty PDFs. No decade-old repeats.', tag: 'MOST LOVED', icon: 'users', span: 'md:col-span-7', hero: true },
    { t: 'PrepOS CUET co-pilot', d: 'Ask PrepOS what to do today. It turns your mocks, weak chapters, saved questions, and DU goals into a clear next move.', tag: 'NEW', icon: 'spark', span: 'md:col-span-5', hero: true },
    { t: 'AI weakness radar', d: 'Smart analytics pinpoint the exact chapter, topic, speed leak, and trap pattern killing your score.', icon: 'radar', span: 'md:col-span-4', chart: true },
    { t: 'Mistake Replay', d: 'Reopen the questions that actually hurt your score and convert them into short benchmark drills.', icon: 'msg', span: 'md:col-span-4' },
    { t: 'DU target path', d: 'CUET-first pathways connect your subjects, score band, and target course to realistic college moves.', icon: 'route', span: 'md:col-span-4', track: true },
  ];

  const testimonials = [
    { n: 'Aanya Kulkarni', r: 'CUET · North Campus', q: 'I used to solve PYQs alone at 2 AM wondering if my speed was normal. MockMob showed me the exact chapter that was dragging my score down.' },
    { n: 'Meera Sharma', r: 'SRCC · B.Com (Hons)', q: 'PrepOS made the plan simple: benchmark, replay mistakes, then push Accountancy. It felt like a senior had mapped the week for me.' },
    { n: 'Atishay Jain', r: 'Hansraj College', q: 'The DU Compass view made my CUET score feel actionable. I could see the colleges, the subject gaps, and the next move without guessing.' },
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
      <section style={{ paddingTop: '120px', paddingBottom: '48px' }} className="px-5 relative overflow-hidden">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[36, 28]}
          className="opacity-[0.15] landing-grid-pattern"
          squaresClassName="hover:fill-volt/20"
        />

        <div className="container-wide text-center relative z-10">
          <ScrollReveal delay={0} distance={16}>
            <Link href="/signup" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/25 mb-7 no-underline" style={{ background: 'rgba(248,113,113,0.04)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-slow" style={{ boxShadow: '0 0 8px rgba(248,113,113,.9)' }}></span>
              <span className="mono-label" style={{ color: 'var(--volt)' }}>Now live — CUET &apos;26 Mock Sprint</span>
              <Icon name="arrow" style={{ color: 'var(--volt)', width: '11px', height: '11px' }} />
            </Link>
          </ScrollReveal>

          <ScrollReveal delay={80} distance={20}>
            <h1 className="display-xl mb-2 text-white">
              Stop grinding alone.<br />
              Rank up with the
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={160}>
            <MorphingText texts={["mob.", "best.", "top 1%."]} className="text-volt italic h-[80px] md:h-[120px]" />
          </ScrollReveal>

          <ScrollReveal delay={240} distance={16}>
            <p className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto mb-8 mt-4" style={{ lineHeight: 1.6 }}>
              India&apos;s CUET-first mock test platform. Take peer-verified mocks, ask <span className="text-volt font-semibold">PrepOS</span> what to do next, and turn every score into a sharper DU admission move.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={320} distance={12}>
            <LandingActions mode="hero" />
            <div className="inline-flex items-center gap-2 text-xs text-zinc-500 mt-3">
              <Icon name="spark" style={{ color: 'var(--volt)', width: '12px', height: '12px' }} />
              No credit card. No spam. Just verified mocks.
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* VALUE STRIP — replaces generic stats bar */}
      <section className="px-5 mb-10 md:mb-20 relative z-10">
        <div className="container-wide">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {valueTiles.map((tile, i) => (
              <ScrollReveal key={tile.label} delay={i * 80} distance={20}>
                <div
                  className="value-tile glass p-5 group"
                  style={{
                    borderColor: tile.accent ? 'rgba(210,240,0,0.25)' : 'rgba(255,255,255,0.08)',
                    background: tile.accent ? 'rgba(210,240,0,0.03)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-3 mb-2.5">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: tile.accent ? 'var(--volt)' : 'rgba(255,255,255,0.06)',
                        color: tile.accent ? '#000' : 'var(--volt)',
                      }}
                    >
                      <Icon name={tile.icon} style={{ width: '16px', height: '16px' }} />
                    </div>
                    <span className="heading text-sm text-white">{tile.label}</span>
                  </div>
                  <p className="text-zinc-400 text-[13px] leading-relaxed m-0">{tile.copy}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden bg-white/5 border-y border-white/5 mb-12 md:mb-20 relative py-6">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10"></div>
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10"></div>
        <ScrollVelocityContainer className="font-display font-bold text-3xl md:text-5xl tracking-tight text-white/40">
          <ScrollVelocityRow baseVelocity={1.6} direction={1} scrollReactivity={false}>
            CUET English <span className="opacity-15 mx-4">—</span> Accountancy <span className="opacity-15 mx-4">—</span> Economics <span className="opacity-15 mx-4">—</span> Psychology <span className="opacity-15 mx-4">—</span> History <span className="opacity-15 mx-4">—</span> Political Science <span className="opacity-15 mx-4">—</span> SRCC <span className="opacity-15 mx-4">—</span> Hansraj <span className="opacity-15 mx-4">—</span>
          </ScrollVelocityRow>
        </ScrollVelocityContainer>
      </div>

      {/* PREPOS PROMO */}
      <section className="px-5 mb-14 md:mb-24">
        <div className="container-std">
          <ScrollReveal distance={30}>
            <div className="prepos-promo glass relative overflow-hidden border-volt/20">
              <div className="prepos-promo-grid">
                <div className="prepos-promo-orb">
                  <PrepOSOrb size={92} active label="OS" />
                </div>
                <div className="prepos-promo-copy">
                  <div className="eyebrow mb-3">{'// PrepOS'}</div>
                  <h2 className="display-md mb-3">A CUET co-pilot that keeps asking, <span className="text-volt italic">what is the next move?</span></h2>
                  <p className="text-zinc-400 leading-relaxed">
                    Open the island from any page. PrepOS can set your daily mission, replan after a bad mock, benchmark you against DU targets, and turn saved mistakes into replay drills.
                  </p>
                </div>
                <div className="prepos-promo-stack" aria-label="PrepOS quick actions">
                  {['Plan today', 'Replay mistakes', 'Benchmark DU path'].map((item, index) => (
                    <div key={item} className="prepos-promo-chip" style={{ animationDelay: `${index * 0.18}s` }}>
                      <span>{index + 1}</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-5 mb-14 md:mb-24">
        <div className="container-std">
          <ScrollReveal>
            <div className="text-center mb-12">
              <div className="eyebrow mb-3">{'// Workflow'}</div>
              <h2 className="display-lg">How MockMob <span className="text-volt" style={{ fontStyle: 'italic' }}>works.</span></h2>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: '1', t: 'Pick your target', d: 'Select your exam and chapters. We curate a custom mock based on what you actually need to study today.' },
              { n: '2', t: 'Enter the Sprint', d: 'Solve peer-reviewed questions in a strict timed environment. Feel the exact pressure of the real exam.', active: true },
              { n: '3', t: 'Analyze & Climb', d: 'Review your trap patterns with the AI Radar and watch your global rank jump on the live leaderboard.' },
            ].map((step, i) => (
              <ScrollReveal key={step.n} delay={i * 100} distance={24}>
                <div className={`glass p-8 text-center relative hover:-translate-y-1 transition-transform ${step.active ? 'border-volt/20 bg-[rgba(210,240,0,0.03)]' : ''}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 font-display font-bold text-xl ${step.active ? 'bg-volt text-black shadow-[0_0_20px_rgba(210,240,0,0.3)]' : 'bg-white/5 text-volt border border-white/10'}`}>
                    {step.n}
                  </div>
                  <h3 className={`heading text-xl mb-3 ${step.active ? 'text-volt' : ''}`}>{step.t}</h3>
                  <p className="text-zinc-400 text-sm">{step.d}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="px-5 mb-14 md:mb-24 relative overflow-hidden py-6 md:py-10">
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
          <ScrollReveal>
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
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
            {features.map((f, i) => (
              <ScrollReveal key={i} delay={i * 80} className={f.span}>
                <div
                  className={`glass p-6 md:p-8 relative overflow-hidden group md:min-h-[280px] h-full`}
                  style={{
                    background: f.hero ? 'rgba(210,240,0,0.02)' : 'rgba(255,255,255,0.015)',
                    borderColor: f.hero ? 'rgba(210,240,0,0.2)' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="feature-dot-layer pointer-events-none opacity-[0.35] group-hover:opacity-100 transition-opacity duration-700"
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
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* DU COMPASS */}
      <section className="px-5 mb-14 md:mb-24">
        <div className="container-std">
          <ScrollReveal distance={30}>
            <div className="compass-card glass relative overflow-hidden border-volt/20">
              <div className="pointer-events-none opacity-40" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <DotPattern
                  width={22}
                  height={22}
                  cx={1}
                  cy={1}
                  cr={1.2}
                  className="text-volt/20"
                  glow={true}
                  style={{ maskImage: 'radial-gradient(ellipse at top left, white, transparent 65%)', WebkitMaskImage: 'radial-gradient(ellipse at top left, white, transparent 65%)' }}
                />
              </div>
              <div className="compass-grid">
                <div className="compass-copy">
                  <div className="eyebrow mb-3">{'// DU Compass · AI guidance'}</div>
                  <h2 className="display-md mb-3 leading-[1.05]">
                    Map your score to<br className="hidden sm:block" /> DU paths <span className="text-volt italic">before the panic.</span>
                  </h2>
                  <p className="text-zinc-400 leading-relaxed">
                    Compass reads your mock score, selected subjects, and category to map realistic Delhi University college and course options, with the marks gap and the next move spelled out.
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
                <DynamicCompassPreview />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-5 mb-14 md:mb-24">
        <div className="container-std">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row items-center md:items-end justify-between mb-10 gap-6 text-center md:text-left">
              <div>
                <div className="eyebrow mb-3">{'// Wall of love'}</div>
                <h2 className="display-lg">The mob <span className="text-volt" style={{ fontStyle: 'italic' }}>speaks.</span></h2>
              </div>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <div className="glass p-8 relative hover:scale-[1.02] transition-transform duration-300 h-full">
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
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 mb-14 md:mb-24 relative py-8 md:py-16 text-center">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(210,240,0,0.08)_0%,transparent_60%)] pointer-events-none" />
        <ScrollReveal>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 bg-volt rounded-xl mx-auto mb-5 flex items-center justify-center text-black shadow-[0_0_30px_rgba(210,240,0,0.3)]">
              <Icon name="zap" style={{ width: '22px', height: '22px' }} />
            </div>
            <h2 className="display-lg mb-3">Stop reading. Start solving.</h2>
            <p className="text-zinc-400 mb-8 max-w-sm mx-auto text-sm md:text-base">The next topper is already on Question 42 today. What are you waiting for?</p>
            <LandingActions mode="primary" />
          </div>
        </ScrollReveal>
      </section>

      <section className="px-5 mb-14 md:mb-24">
        <div className="container-narrow">
          <ScrollReveal>
            <div className="text-center mb-8">
              <div className="eyebrow mb-3">{'// CUET FAQ'}</div>
              <h2 className="display-md">Quick answers before you start.</h2>
            </div>
          </ScrollReveal>
          <div className="grid gap-3">
            {faqs.map((faq, i) => (
              <ScrollReveal key={faq.question} delay={i * 60}>
                <details className="glass p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="cursor-pointer list-none font-display text-lg font-bold text-white">
                    {faq.question}
                  </summary>
                  <p className="pt-3 text-sm leading-relaxed text-zinc-400">{faq.answer}</p>
                </details>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
      <style>{`
        .value-tile {
          transition: border-color 0.25s ease, transform 0.25s ease;
        }
        .value-tile:hover {
          border-color: rgba(210,240,0,0.2);
          transform: translateY(-2px);
        }
        .prepos-promo {
          padding: clamp(20px, 3vw, 32px);
          background:
            radial-gradient(circle at 12% 18%, rgba(210,240,0,.12), transparent 36%),
            radial-gradient(circle at 84% 70%, rgba(85,255,197,.07), transparent 42%),
            rgba(255,255,255,.015);
        }
        .prepos-promo::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(rgba(210,240,0,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(210,240,0,.07) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: radial-gradient(ellipse at center, black, transparent 72%);
          opacity: .42;
        }
        .prepos-promo-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr;
          gap: 22px;
          align-items: center;
        }
        @media (min-width: 860px) {
          .prepos-promo-grid {
            grid-template-columns: auto minmax(0, 1fr) minmax(220px, .55fr);
          }
        }
        .prepos-promo-orb {
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        .prepos-promo-copy {
          max-width: 680px;
        }
        .prepos-promo-stack {
          display: grid;
          gap: 10px;
        }
        .prepos-promo-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          background: rgba(0,0,0,.28);
          padding: 12px 14px;
          color: #e4e4e7;
          font-size: 13px;
          font-weight: 800;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
          animation: prepos-chip-float 4.4s ease-in-out infinite;
        }
        .prepos-promo-chip span {
          display: inline-flex;
          width: 24px;
          height: 24px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: var(--volt);
          color: #050604;
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 900;
        }
        @keyframes prepos-chip-float {
          0%, 100% { transform: translateY(0); border-color: rgba(255,255,255,.08); }
          50% { transform: translateY(-4px); border-color: rgba(210,240,0,.22); }
        }
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
        @media (hover: none) {
          .feature-dot-layer {
            opacity: .78 !important;
            animation: mobile-dot-breathe 4.2s ease-in-out infinite;
          }
        }
        @keyframes mobile-dot-breathe {
          0%, 100% { opacity: .32; }
          50% { opacity: .84; }
        }
        @media (prefers-reduced-motion: reduce) {
          .prepos-promo-chip,
          .feature-dot-layer,
          .value-tile {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
