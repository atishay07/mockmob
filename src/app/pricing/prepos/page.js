export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowLeft, Check, Infinity, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';
import { PrepOSOrb } from '@/components/ui/PrepOSOrb';
import { PrepOSCreditPurchaseButton } from '@/components/billing/PrepOSCreditPurchaseButton';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import {
  AI_CREDIT_PACKS,
  AI_FREE_MONTHLY_CREDITS,
  AI_PRO_INCLUDED_MONTHLY_CREDITS,
  getAIWallet,
} from '@/services/credits/aiCreditWallet';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'PrepOS Credit Packs for CUET AI Planning',
  description:
    'Buy PrepOS credits for CUET mission planning, mock autopsy, Mistake Replay, and DU target guidance. Purchased credits never expire.',
  path: '/pricing/prepos',
});

const faqs = [
  {
    q: 'Do purchased PrepOS credits expire?',
    a: 'No. Monthly included credits reset every month, but purchased PrepOS credits stay in your wallet until you spend them.',
  },
  {
    q: 'What is the difference between monthly and purchased credits?',
    a: 'Monthly credits are included with Free or Pro and are used first. Purchased credits are bonus credits and only spend after your monthly allowance is used.',
  },
  {
    q: 'Is Pro still separate?',
    a: 'Yes. Pro is the ₹69/month subscription. PrepOS credit packs are one-time top-ups for heavier AI usage.',
  },
];


export default async function PrepOSPricingPage() {
  const session = await auth();
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const wallet = currentUser ? await getAIWallet(currentUser) : null;
  const isPaid = Boolean(currentUser?.isPremium || currentUser?.subscriptionStatus === 'active');

  return (
    <div className="view min-h-screen">
      <JsonLd
        id="prepos-pricing-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
          { name: 'PrepOS credits', path: '/pricing/prepos' },
        ])}
      />
      <JsonLd
        id="prepos-pricing-faq-json-ld"
        data={faqJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))}
      />
      <NavBar />

      <main className="container-wide px-5 pb-16 pt-[108px]">
        <section className="prepos-price-hero">
          <div className="prepos-hero-orb">
            <PrepOSOrb size={118} active label="AI" />
          </div>
          <div className="prepos-hero-copy">
            <Link href="/pricing" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full py-1 text-sm font-bold text-zinc-400 no-underline transition hover:text-volt" style={{ minHeight: '44px' }}>
              <ArrowLeft className="h-4 w-4" />
              Back to Pro pricing
            </Link>
            <div className="mono-label mb-3 !text-volt">PrepOS credit packs</div>
            <h1 className="display-lg mb-4">
              Keep your CUET co-pilot running when the month gets intense.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-400">
              Free users get {AI_FREE_MONTHLY_CREDITS} credits monthly. Pro users get {AI_PRO_INCLUDED_MONTHLY_CREDITS}. If you need more mock autopsy, mission replans, or DU path guidance, top up without changing your subscription.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Your balance" value={wallet ? wallet.total : 'Login'} />
              <Metric label="Monthly included" value={wallet ? `${wallet.includedRemaining}/${wallet.includedMonthlyCredits}` : isPaid ? AI_PRO_INCLUDED_MONTHLY_CREDITS : AI_FREE_MONTHLY_CREDITS} />
              <Metric label="Purchased credits" value={wallet?.bonusCredits ?? 0} />
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 grid max-w-6xl gap-5 lg:grid-cols-3">
          {AI_CREDIT_PACKS.map((pack) => (
            <article key={pack.key} className={`prepos-pack-card ${pack.featured ? 'is-featured' : ''}`}>
              {pack.featured ? <div className="prepos-pack-badge">Best value</div> : null}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mono-label !text-zinc-500">{pack.shortLabel}</div>
                  <h2 className="mt-2 font-display text-3xl font-black text-zinc-50">{pack.credits} credits</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <WalletCards className="h-5 w-5 text-volt" />
                </div>
              </div>
              <p className="mt-4 min-h-[48px] text-sm leading-6 text-zinc-400">{pack.description}</p>
              <div className="mt-5 flex items-end justify-between border-t border-white/8 pt-5">
                <div>
                  <span className="text-sm text-zinc-500">One-time</span>
                  <div className="font-display text-4xl font-black text-volt">₹{pack.amountInr}</div>
                </div>
                <div className="text-right text-xs font-bold text-zinc-500">
                  <span className="block">₹{(pack.amountInr / pack.credits).toFixed(2)}</span>
                  <span className="block">per credit</span>
                </div>
              </div>
              <PrepOSCreditPurchaseButton pack={pack} className="mt-5" />
            </article>
          ))}
        </section>

        <section className="mx-auto mt-12 max-w-3xl">
          <div className="prepos-rules-panel">
            <div className="mono-label mb-3 !text-volt">How credits work</div>
            <div className="grid gap-3">
              {[
                ['Monthly first', 'Included Free/Pro credits spend before purchased credits.'],
                ['Never expire', 'Purchased credits stay until used.'],
                ['Separate from Pro', 'Top-ups do not change your subscription.'],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-volt text-zinc-950">
                    {title === 'Never expire' ? <Infinity className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </span>
                  <div>
                    <div className="font-display text-lg font-black text-zinc-50">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <LiquidGlassButton asChild variant="ghost" size="md" className="mt-5 w-full">
              <Link href="/pricing">
                <ShieldCheck className="h-4 w-4" />
                Compare Free vs Pro
              </Link>
            </LiquidGlassButton>
          </div>
        </section>

        <section className="mx-auto mt-14 max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-volt/25 bg-volt/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-volt" />
              <span className="mono-label !text-volt">Questions</span>
            </div>
            <h2 className="display-md">PrepOS credit FAQs</h2>
          </div>
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="glass p-5">
                <h3 className="font-display text-lg font-black text-zinc-50">{faq.q}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
      <style>{`
        .prepos-price-hero {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: clamp(22px, 4vw, 48px);
          align-items: center;
          max-width: 1120px;
          margin: 0 auto;
          border: 1px solid rgba(210,240,0,.18);
          border-radius: 28px;
          background:
            radial-gradient(circle at 20% 18%, rgba(210,240,0,.16), transparent 34%),
            radial-gradient(circle at 85% 82%, rgba(85,255,197,.08), transparent 34%),
            rgba(255,255,255,.025);
          padding: clamp(24px, 5vw, 48px);
        }
        .prepos-price-hero::before,
        .prepos-pack-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(210,240,0,.2) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse at center, black, transparent 74%);
          opacity: .3;
        }
        .prepos-price-hero > *,
        .prepos-pack-card > * {
          position: relative;
          z-index: 1;
        }
        @media (min-width: 860px) {
          .prepos-price-hero {
            grid-template-columns: 170px minmax(0, 1fr);
          }
        }
        .prepos-hero-orb {
          display: flex;
          justify-content: flex-start;
        }
        .prepos-pack-card,
        .prepos-rules-panel {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.02));
          padding: 22px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }
        .prepos-pack-card.is-featured {
          border-color: rgba(210,240,0,.34);
          box-shadow: 0 0 42px rgba(210,240,0,.08), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .prepos-pack-badge {
          display: inline-flex;
          width: fit-content;
          margin-bottom: 14px;
          border-radius: 999px;
          border: 1px solid rgba(210,240,0,.34);
          background: rgba(210,240,0,.12);
          padding: 5px 9px;
          color: var(--volt);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <span className="mono-label !text-zinc-500">{label}</span>
      <strong className="mt-2 block font-display text-2xl font-black text-zinc-50">{value}</strong>
    </div>
  );
}
