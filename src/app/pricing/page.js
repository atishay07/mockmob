export const dynamic = "force-dynamic";
import React from 'react';
import Link from 'next/link';
import { Check, ChevronDown, PartyPopper, ShieldCheck, Sparkles, X } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { PricingCard } from '@/components/ui/PricingCard';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';
import { RazorpayPaymentButton } from '@/components/billing/RazorpayPaymentButton';
import { PriceIncreaseCountdown } from '@/components/pricing/PriceIncreaseCountdown';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'MockMob Pricing for CUET Mock Tests & Analytics',
  description:
    'Start free or unlock MockMob Pro for unlimited CUET mocks, advanced Radar analytics, bookmarks, and Admission Compass.',
  path: '/pricing',
});

const plans = [
  {
    name: 'Free',
    price: '₹0',
    cycle: '/month',
    description: 'Perfect for getting started with focused mock practice.',
    ctaLabel: 'Start Free',
    features: [
      'Quick Practice (5 to 20 questions) — credit-gated',
      'Full Mock (50 questions, 60 minutes) — credit-gated',
      'Weekly progress tracking',
      '25 saved questions',
      'Community leaderboard access',
    ],
  },
  {
    name: 'Pro',
    price: '₹69',
    originalPrice: '₹199',
    cycle: '/month',
    description: 'For CUET 2026 aspirants who want mocks, analytics, and college direction in one place.',
    ctaLabel: 'Go Pro',
    planId: 'pro_monthly',
    amount: 6900,
    featured: true,
    features: [
      'Admission Compass — CUET score bands and DU college recommendations',
      'Custom subject-course eligibility mapping for your target colleges',
      'Premium Radar with weakness analysis and chapter priority maps',
      'Difficulty selector: easy, medium, hard, or auto',
      'Fast-lane mock generation and unlimited bookmarks',
      'Unlimited Quick Practice and Full Mock',
      'Smart Practice — adaptive, targets your weak topics',
      'NTA Mode — strict CUET exam simulation (50 Qs, 60 min, PYQ-anchored)',
    ],
  }
];

// ── Comparison rows are grouped to keep the table scannable: ──
//   1. Core test modes (available to all)
//   2. Core platform features (available to all)
//   3. Advanced features (Pro) — Compass family is highlighted Most Popular
//   4. Advanced test modes (Pro) — bottom of the table
const COMPARISON_GROUPS = [
  {
    heading: 'Core test modes',
    rows: [
      ['Quick Practice (5 to 20 Qs)', 'Credit-gated · 10 credits each', 'Unlimited'],
      ['Full Mock (50 Qs · 60 min)', 'Credit-gated · 50 credits each', 'Unlimited'],
    ],
  },
  {
    heading: 'Platform basics',
    rows: [
      ['Saved questions', '25 saves', 'Unlimited saves'],
      ['Community leaderboard', true, true],
      ['Weekly progress tracking', true, true],
    ],
  },
  {
    heading: 'Advanced features',
    rows: [
      ['Admission Compass', false, true, 'popular'],
      ['CUET score band estimate', false, true, 'popular'],
      ['College recommendations', false, true, 'popular'],
      ['Custom subject-course mapping', false, true, 'popular'],
      ['Difficulty selector', false, 'Easy, medium, hard, auto'],
      ['Premium Radar analysis', false, true],
      ['Chapter priority maps', false, true],
      ['Fast-lane mock generation', false, true],
    ],
  },
  {
    heading: 'Advanced test modes',
    rows: [
      ['Smart Practice — adaptive', false, 'Unlimited'],
      ['NTA Mode — CUET exam simulation', false, 'Unlimited'],
    ],
  },
];

const compassShots = [
  {
    label: 'CUET score band',
    title: '872/1000',
    detail: 'High chance band',
    rows: ['Accountancy 184/200', 'Economics 172/200', 'English 178/200'],
  },
  {
    label: 'College ideas',
    title: 'SRCC, Hansraj, Venky',
    detail: 'Ranked by fit',
    rows: ['B.Com (Hons)', 'Economics', 'Category-aware targets'],
  },
  {
    label: 'Custom mapping',
    title: 'Subject to course fit',
    detail: 'Eligibility checked',
    rows: ['Your 5 subjects', 'Target college courses', 'Next mock priority'],
  },
];

const PRICE_UPDATE_DEADLINE = '2026-05-04T00:00:00+05:30';

const faqs = [
  {
    q: 'How does the Leaderboard work?',
    a: 'Every mock you take earns you XP based on your speed, accuracy, and difficulty of the questions. Your XP dictates your rank on the global leaderboard. Taking the daily "Mock Sprint" gives you a multiplier to help you climb faster.'
  },
  {
    q: 'What exactly is the AI Weakness Tracker?',
    a: 'Instead of only showing a raw score, the premium layer connects Arena attempts, Explore solves, bookmarks, and speed signals to show the chapters slowing you down.'
  },
  {
    q: 'What does Admission Compass compare?',
    a: 'Compass compares your mock CUET score band, selected subjects, category, and target course direction to suggest realistic DU college-course options, aspirational picks, and the subject gaps to attack next.'
  },
  {
    q: 'Is Compass the same as Radar?',
    a: 'No. Radar explains why your score is moving by showing weak chapters, speed problems, and priority maps. Compass uses that progress history to turn your CUET score estimate into college recommendations and course mapping.'
  },
  {
    q: 'Can I cancel my Pro plan anytime?',
    a: 'Absolutely. You can cancel your ₹69/month subscription at any time with no hidden fees or lock-in periods.'
  },
  {
    q: 'Are the community mocks reliable?',
    a: 'Yes! Every question uploaded by the community goes through an AI moderation pipeline and is peer-reviewed by top scorers. Questions with low ratings or incorrect keys are aggressively pruned from the active pool.'
  }
];

function ComparisonValue({ value, pro = false, highlight = false }) {
  if (value === true) {
    return (
      <span className={`inline-flex items-center gap-2 ${pro || highlight ? 'text-volt' : 'text-zinc-200'}`}>
        <Check className="h-4 w-4" />
        Included
      </span>
    );
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center gap-2 text-zinc-500">
        <X className="h-4 w-4" />
        Not included
      </span>
    );
  }

  return <span className={pro || highlight ? 'text-volt' : 'text-zinc-300'}>{value}</span>;
}

export default async function PricingPage() {
  const session = await auth();
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const isCurrentUserPremium = Boolean(currentUser?.isPremium);

  return (
    <div className="view min-h-screen">
      <JsonLd
        id="pricing-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
        ])}
      />
      <JsonLd
        id="pricing-faq-json-ld"
        data={faqJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))}
      />
      <NavBar />
      <div className="container-wide px-5 pb-14 pt-[108px]">

        <section className="mx-auto mb-10 max-w-3xl text-center">
          <div className="sale-ribbon mb-5 inline-flex items-center gap-3 rounded-full border border-volt/50 bg-volt/15 px-5 py-2">
            <PartyPopper className="h-4 w-4 text-volt" />
            <span className="mono-label !text-volt">Midnight price update</span>
            <span className="sale-spark sale-spark-1" />
            <span className="sale-spark sale-spark-2" />
            <span className="sale-spark sale-spark-3" />
          </div>
          <h1 className="display-lg mb-4">
            Pricing that keeps your <span className="text-volt italic">momentum</span> alive.
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-400">
            Start free, or lock the current Pro price before the new CUET 2026 pricing goes live at 12:00 AM IST.
          </p>
          <div className="sale-price-strip mt-5 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-volt/25 bg-[rgba(210,240,0,0.08)] px-5 py-3 text-sm">
            <ShieldCheck className="h-4 w-4 text-volt" />
            <span className="text-zinc-300">Real MRP</span>
            <span className="font-semibold text-zinc-500 line-through decoration-zinc-500/80 decoration-2">₹199/month</span>
            <span className="text-zinc-500">now</span>
            <span className="font-display text-2xl font-extrabold text-volt">₹69/month</span>
          </div>
          <PriceIncreaseCountdown deadline={PRICE_UPDATE_DEADLINE} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <PricingCard
              key={plan.name}
              {...plan}
              delay={index * 80}
              ctaElement={plan.planId ? (
                <RazorpayPaymentButton
                  planId={plan.planId}
                  amount={plan.amount}
                  label={plan.ctaLabel}
                  initialIsPremium={isCurrentUserPremium}
                />
              ) : null}
            />
          ))}
        </section>

        <section className="mx-auto mt-10 max-w-4xl">
          <div className="prepos-credit-section">
            <div className="prepos-credit-section-header">
              <div>
                <h2 className="font-display text-2xl font-black text-zinc-50 sm:text-3xl">Need more AI guidance?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                  Add AI credits when you want deeper mock autopsies, Rival battles, trap drills, or comeback plans. Credits never expire.
                </p>
              </div>
            </div>
            <div className="prepos-credit-packs">
              {[
                { name: 'AI Boost', price: '₹10', credits: '50', desc: 'Quick top-up for a few extra Mentor questions or a trap drill.' },
                { name: 'Prep Pack', price: '₹20', credits: '150', desc: 'Deep mock autopsy, Rival battle, and a comeback plan.' },
                { name: 'Power Pack', price: '₹50', credits: '400', desc: 'Best value for a full PrepOS sprint across planning, replay, and Rival battles.', popular: true },
              ].map((pack) => (
                <div key={pack.name} className={`prepos-credit-pack-card ${pack.popular ? 'is-popular' : ''}`}>
                  {pack.popular && <span className="prepos-pack-badge">Best value</span>}
                  <div className="prepos-pack-price">{pack.price}</div>
                  <div className="prepos-pack-name">{pack.name}</div>
                  <div className="prepos-pack-credits">{pack.credits} AI credits</div>
                  <p className="prepos-pack-desc">{pack.desc}</p>
                  <LiquidGlassButton asChild variant={pack.popular ? 'volt' : 'ghost'} size="sm" className="w-full mt-auto">
                    <Link href="/pricing/prepos#prepos-plan-packs">
                      Get {pack.name}
                    </Link>
                  </LiquidGlassButton>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-14 max-w-5xl">
          <div className="mb-6 flex flex-col gap-2 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-volt/25 bg-volt/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-volt" />
              <span className="mono-label !text-volt">Compass preview</span>
            </div>
            <h2 className="display-md">Turn every mock into a DU admission move.</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {compassShots.map((shot) => (
              <div key={shot.label} className="compass-preview-panel">
                <div className="mono-label mb-3">{shot.label}</div>
                <div className="font-display text-2xl font-extrabold leading-tight text-white">{shot.title}</div>
                <div className="mb-4 mt-1 text-sm text-volt">{shot.detail}</div>
                <div className="flex flex-col gap-2">
                  {shot.rows.map((row) => (
                    <div key={row} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">
                      <span>{row}</span>
                      <Check className="h-3.5 w-3.5 shrink-0 text-volt" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-14 max-w-5xl">
          <div className="mb-6 text-center">
            <h2 className="display-md mb-2">Free vs Pro</h2>
            <p className="text-zinc-400">Everything serious CUET prep needs, laid out clearly.</p>
          </div>

          <div className="pricing-comparison overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="comparison-head grid grid-cols-[1.4fr_0.85fr_0.85fr] border-b border-white/10 bg-white/[0.04] text-xs font-mono uppercase tracking-[0.18em] text-zinc-500">
              <div className="px-5 py-4">Feature</div>
              <div className="px-5 py-4">Free</div>
              <div className="px-5 py-4 text-volt">Pro</div>
            </div>
            {COMPARISON_GROUPS.map((group) => (
              <React.Fragment key={group.heading}>
                <div className="comparison-group-heading">
                  {group.heading}
                </div>
                {group.rows.map(([feature, free, pro, marker]) => {
                  const isPopular = marker === 'popular';
                  return (
                    <div
                      key={feature}
                      className={`comparison-row grid grid-cols-1 border-b border-white/[0.06] last:border-b-0 sm:grid-cols-[1.4fr_0.85fr_0.85fr] ${isPopular ? 'is-popular' : ''}`}
                    >
                      <div className="comparison-feature px-5 pb-2 pt-4 text-sm font-semibold text-white sm:py-4">
                        <span>{feature}</span>
                        {isPopular ? (
                          <span className="ml-2 inline-flex rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-volt">
                            Most popular
                          </span>
                        ) : null}
                      </div>
                      <div className="comparison-value px-5 py-2 text-sm sm:py-4" data-label="Free"><ComparisonValue value={free} /></div>
                      <div className="comparison-value px-5 pb-4 pt-2 text-sm sm:py-4" data-label="Pro"><ComparisonValue value={pro} pro highlight={isPopular} /></div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-zinc-400">
            All this for a nominal price of <span className="font-semibold text-volt">₹69 per month</span>.
          </p>
        </section>

        <section className="mx-auto mt-20 max-w-3xl text-left">
          <div className="text-center mb-10">
            <h2 className="display-md mb-2">Frequently Asked Questions</h2>
            <p className="text-zinc-400">Everything you need to know about MockMob</p>
          </div>
          
          <div className="flex flex-col gap-3">
            {faqs.map((faq, index) => (
              <details key={index} className="glass p-5 group [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer list-none font-display text-lg font-bold">
                  {faq.q}
                  <ChevronDown className="h-5 w-5 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-4 text-zinc-400 leading-relaxed text-sm">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-sm text-zinc-500">Need team or institute pricing? We can set it up in minutes.</p>
          <div className="mt-4 flex justify-center">
            <LiquidGlassButton asChild variant="ghost" size="md">
              <a href="mailto:support@mockmob.in?subject=Team%20%2F%20institute%20pricing">Talk to us</a>
            </LiquidGlassButton>
          </div>
        </section>
      </div>
      <MarketingFooter />
      <style>{`
        .prepos-credit-section {
          overflow: hidden;
          border: 1px solid rgba(210,240,0,.2);
          border-radius: 22px;
          background:
            radial-gradient(circle at 8% 18%, rgba(210,240,0,.09), transparent 38%),
            rgba(255,255,255,.02);
          padding: clamp(20px, 3vw, 32px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }
        .prepos-credit-section-header {
          margin-bottom: 20px;
        }
        .prepos-credit-packs {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .prepos-credit-packs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .prepos-credit-pack-card {
          position: relative;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 16px;
          background: rgba(0,0,0,.2);
          padding: 20px;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .prepos-credit-pack-card:hover {
          border-color: rgba(255,255,255,.16);
          transform: translateY(-2px);
        }
        .prepos-credit-pack-card.is-popular {
          border-color: rgba(210,240,0,.3);
          background: rgba(210,240,0,.04);
        }
        .prepos-credit-pack-card.is-popular:hover {
          border-color: rgba(210,240,0,.5);
        }
        .prepos-pack-badge {
          position: absolute;
          top: -1px;
          right: 16px;
          background: var(--volt);
          color: #000;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 0 0 6px 6px;
        }
        .prepos-pack-price {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          line-height: 1;
          margin-bottom: 2px;
        }
        .prepos-pack-name {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          color: var(--volt);
          margin-bottom: 4px;
        }
        .prepos-pack-credits {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: #71717a;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .prepos-pack-desc {
          font-size: 13px;
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0 0 16px;
          flex: 1;
        }
        .prepos-credit-panel {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          align-items: center;
          border: 1px solid rgba(210,240,0,.2);
          border-radius: 22px;
          background:
            radial-gradient(circle at 9% 20%, rgba(210,240,0,.11), transparent 34%),
            radial-gradient(circle at 92% 72%, rgba(85,255,197,.065), transparent 38%),
            rgba(255,255,255,.025);
          padding: clamp(20px, 3vw, 30px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }
        .prepos-credit-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(210,240,0,.18) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse at center, black, transparent 76%);
          opacity: .36;
        }
        .prepos-credit-panel > * {
          position: relative;
          z-index: 1;
        }
        @media (min-width: 900px) {
          .prepos-credit-panel {
            grid-template-columns: auto minmax(0, 1fr) minmax(230px, .42fr);
          }
          .prepos-pack-row {
            grid-column: 2 / 4;
          }
        }
        .prepos-credit-orb {
          display: flex;
          align-items: center;
        }
        .prepos-credit-copy {
          max-width: 680px;
        }
        .prepos-credit-metrics {
          display: grid;
          gap: 10px;
        }
        .prepos-credit-metrics div,
        .prepos-pack {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          background: rgba(0,0,0,.24);
          padding: 12px 14px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
        }
        .prepos-credit-metrics span,
        .prepos-credit-metrics em,
        .prepos-pack span {
          display: block;
          color: #71717a;
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
        }
        .prepos-credit-metrics strong,
        .prepos-pack strong {
          display: block;
          color: #fff;
          font-family: var(--font-display);
          font-size: 20px;
          line-height: 1.05;
          margin: 3px 0;
        }
        .prepos-pack-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 640px) {
          .prepos-pack-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .sale-ribbon {
          position: relative;
          overflow: visible;
          box-shadow: 0 0 30px rgba(210, 240, 0, .12);
          transition: transform .25s ease, box-shadow .25s ease;
        }
        .sale-ribbon:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 46px rgba(210, 240, 0, .2);
        }
        .sale-spark {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--volt);
          opacity: 0;
          pointer-events: none;
        }
        .sale-spark-1 { left: 16%; top: -8px; }
        .sale-spark-2 { right: 20%; top: -10px; }
        .sale-spark-3 { right: 12%; bottom: -8px; }
        .sale-ribbon:hover .sale-spark {
          animation: sale-pop .8s ease both;
        }
        .sale-ribbon:hover .sale-spark-2 { animation-delay: .08s; }
        .sale-ribbon:hover .sale-spark-3 { animation-delay: .16s; }
        .sale-price-strip {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }
        .price-countdown-panel {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: center;
          border: 1px solid rgba(210,240,0,.28);
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(210,240,0,.105), rgba(255,255,255,.025) 44%, rgba(210,240,0,.055)),
            rgba(0,0,0,.24);
          padding: 16px;
          text-align: left;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 18px 60px rgba(0,0,0,.24);
        }
        @media (min-width: 720px) {
          .price-countdown-panel {
            grid-template-columns: minmax(0, 1fr) auto;
            padding: 18px 20px;
          }
        }
        .price-countdown-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--volt);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .price-countdown-copy p {
          margin: 6px 0 0;
          color: #d4d4d8;
          font-size: 14px;
          line-height: 1.55;
        }
        .price-countdown-copy strong {
          color: var(--volt);
          font-weight: 900;
        }
        .price-countdown-timer {
          display: grid;
          grid-template-columns: repeat(3, minmax(66px, 1fr));
          gap: 8px;
        }
        .price-countdown-timer span {
          display: grid;
          place-items: center;
          min-height: 64px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 14px;
          background: rgba(0,0,0,.26);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }
        .price-countdown-timer strong {
          color: #f4f4f5;
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 950;
          line-height: 1;
        }
        .price-countdown-timer em {
          color: #a1a1aa;
          font-family: var(--font-mono);
          font-size: 10px;
          font-style: normal;
          font-weight: 800;
          letter-spacing: .12em;
          line-height: 1;
          margin-top: 5px;
          text-transform: uppercase;
        }
        .price-countdown-live {
          grid-column: 1 / -1;
          min-width: 220px;
          padding: 0 18px;
          color: var(--volt);
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 900;
        }
        .compass-preview-panel {
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.02));
          padding: 18px;
          min-height: 238px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }
        .comparison-group-heading {
          padding: 14px 20px 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: #71717a;
          background: rgba(0,0,0,.18);
          border-bottom: 1px solid rgba(255,255,255,.06);
          border-top: 1px solid rgba(255,255,255,.06);
        }
        .pricing-comparison .comparison-head > div + div,
        .pricing-comparison .comparison-row > div + div {
          border-left: 1px solid rgba(255,255,255,.05);
        }
        /* Subtle highlight on the entire Pro column. */
        .pricing-comparison .comparison-head > div:last-child,
        .pricing-comparison .comparison-row > div:last-child {
          background: rgba(210,240,0,.025);
        }
        .pricing-comparison .comparison-row.is-popular {
          background: rgba(210,240,0,.05);
        }
        .pricing-comparison .comparison-row.is-popular > div:last-child {
          background: rgba(210,240,0,.07);
        }
        @keyframes sale-pop {
          0% { opacity: 0; transform: translateY(8px) scale(.7); }
          40% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-18px) scale(1.2); }
        }
        @media (max-width: 639px) {
          .comparison-head {
            display: none;
          }
          .pricing-comparison .comparison-row > div + div {
            border-left: 0;
          }
          .pricing-comparison .comparison-row > div:last-child {
            background: transparent;
          }
          .comparison-row {
            gap: 0;
            padding: 14px;
          }
          .comparison-feature {
            padding: 0 0 12px;
            line-height: 1.45;
          }
          .comparison-value {
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr);
            align-items: center;
            gap: 12px;
            min-height: 44px;
            border-top: 1px solid rgba(255,255,255,.06);
            padding: 10px 0;
          }
          .comparison-value::before {
            content: attr(data-label);
            color: #71717a;
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .12em;
            text-transform: uppercase;
          }
          .comparison-value > span {
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}
