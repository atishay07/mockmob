export const dynamic = "force-dynamic";
import React from 'react';
import Link from 'next/link';
import { Check, ChevronDown, PartyPopper, ShieldCheck, Sparkles, X } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PricingCard } from '@/components/ui/PricingCard';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';
import { RazorpayPaymentButton } from '@/components/billing/RazorpayPaymentButton';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    cycle: '/month',
    description: 'Perfect for getting started with focused mock practice.',
    ctaLabel: 'Start Free',
    features: ['Credit-gated mocks', 'Weekly progress bar', '25 saved questions', 'Community leaderboard access'],
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
      'Unlimited mocks across your CUET subjects',
      'Difficulty selector: easy, medium, hard, or auto',
      'Premium Radar with weakness analysis and chapter priority maps',
      'Admission Compass with CUET score bands and DU college recommendations',
      'Custom subject-course eligibility mapping for your target colleges',
      'Fast-lane mock generation and unlimited bookmarks',
      'AI weakness prompts and premium mock recipes',
    ],
  }
];

const comparisonRows = [
  ['CUET mock practice', 'Credit gated', 'Unlimited'],
  ['Saved questions', '25 saves', 'Unlimited saves'],
  ['Community leaderboard', true, true],
  ['Weekly progress tracking', true, true],
  ['Admission Compass', false, true, true],
  ['CUET score band estimate', false, true, true],
  ['College recommendations', false, true, true],
  ['Custom subject-course mapping', false, true, true],
  ['Difficulty selector', false, 'Easy, medium, hard, auto'],
  ['Premium Radar analysis', false, true],
  ['Chapter priority maps', false, true],
  ['AI weakness prompts', false, true],
  ['Fast-lane mock generation', false, true],
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
      <NavBar />
      <div className="container-wide px-5 pb-14 pt-[108px]">

        <section className="mx-auto mb-10 max-w-3xl text-center">
          <div className="sale-ribbon mb-5 inline-flex items-center gap-3 rounded-full border border-volt/50 bg-volt/15 px-5 py-2">
            <PartyPopper className="h-4 w-4 text-volt" />
            <span className="mono-label !text-volt">CUET 2026 sale is live</span>
            <span className="sale-spark sale-spark-1" />
            <span className="sale-spark sale-spark-2" />
            <span className="sale-spark sale-spark-3" />
          </div>
          <h1 className="display-lg mb-4">
            Pricing that keeps your <span className="text-volt italic">momentum</span> alive.
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-400">
            Start free, grow when you are ready, and keep every mock session focused on rank gains.
          </p>
          <div className="sale-price-strip mt-5 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-volt/25 bg-[rgba(210,240,0,0.08)] px-5 py-3 text-sm">
            <ShieldCheck className="h-4 w-4 text-volt" />
            <span className="text-zinc-300">Real MRP</span>
            <span className="font-semibold text-zinc-500 line-through decoration-zinc-500/80 decoration-2">₹199/month</span>
            <span className="text-zinc-500">now</span>
            <span className="font-display text-2xl font-extrabold text-volt">₹69/month</span>
          </div>
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

        <section className="mx-auto mt-14 max-w-5xl">
          <div className="mb-6 flex flex-col gap-2 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-volt/25 bg-volt/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-volt" />
              <span className="mono-label !text-volt">Compass preview</span>
            </div>
            <h2 className="display-md">See how Compass sells the score story.</h2>
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

          <div className="pricing-comparison overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="comparison-head grid grid-cols-[1.2fr_0.9fr_0.9fr] border-b border-white/10 bg-white/[0.035] text-xs font-mono uppercase tracking-[0.18em] text-zinc-500">
              <div className="px-4 py-4">Feature</div>
              <div className="px-4 py-4">Free</div>
              <div className="px-4 py-4 text-volt">Pro</div>
            </div>
            {comparisonRows.map(([feature, free, pro, highlight]) => (
              <div key={feature} className={`comparison-row grid grid-cols-1 border-b border-white/[0.08] last:border-b-0 sm:grid-cols-[1.2fr_0.9fr_0.9fr] ${highlight ? 'bg-volt/[0.035]' : ''}`}>
                <div className="comparison-feature px-4 pb-2 pt-4 text-sm font-semibold text-white sm:py-4">
                  <span>{feature}</span>
                  {highlight ? (
                    <span className="ml-2 inline-flex rounded-full border border-volt/25 bg-volt/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-volt">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <div className="comparison-value px-4 py-2 text-sm sm:py-4" data-label="Free"><ComparisonValue value={free} /></div>
                <div className="comparison-value px-4 pb-4 pt-2 text-sm sm:py-4" data-label="Pro"><ComparisonValue value={pro} pro highlight={highlight} /></div>
              </div>
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
              <Link href="/signup">Talk to us</Link>
            </LiquidGlassButton>
          </div>
        </section>
      </div>
      <MarketingFooter />
      <style>{`
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
        .compass-preview-panel {
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.02));
          padding: 18px;
          min-height: 238px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
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
            min-height: 42px;
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
