export const dynamic = 'force-dynamic';

// AI credits: what a student's AI credits are, what they have, and how they spend. A plain page on the
// marketing tokens, so Day and Night both read at AA: one heading, the balance (or one sign-in line),
// a ruled list of the three rules, the FAQs. No orb, no gradient, no tiles. The old /pricing/prepos
// address redirects here.
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { PrepOSCreditPurchaseButton } from '@/components/billing/PrepOSCreditPurchaseButton';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import {
  AI_CREDIT_PACKS,
  AI_FREE_MONTHLY_CREDITS,
  AI_PRO_INCLUDED_MONTHLY_CREDITS,
  isPaidUser,
  aiCommerceOpen,
  readAIWallet,
} from '@/services/credits/aiCreditWallet';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';
import { runtimeAiReleased } from '@/../data/capabilities';
import { aiCreditsRules, aiCreditsStatusLine } from './aiCreditsCopy.mjs';

export const metadata = seoMetadata({
  title: 'AI credits',
  description:
    'How MockMob AI credits work: monthly credits on Free and Pro, purchased credits that do not expire, and your current balance.',
  path: '/pricing/ai-credits',
});

const faqs = [
  {
    q: 'Do purchased AI credits expire?',
    a: 'No. Monthly included credits reset every month, but purchased AI credits stay in your account until you spend them.',
  },
  {
    q: 'What is the difference between monthly and purchased credits?',
    a: 'Monthly credits are included with Free or Pro and are used first. Purchased credits are bonus credits and only spend after your monthly allowance is used.',
  },
  {
    q: 'Is Pro still separate?',
    a: 'Yes. Pro is billed separately from the optional AI credits. New top-ups are currently paused and existing balances are preserved.',
  },
];

export default async function AICreditsPage() {
  const session = await auth();
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const wallet = currentUser ? await readAIWallet(currentUser) : null;
  const isPaid = isPaidUser(currentUser);
  const checkoutOpen = aiCommerceOpen();
  const monthly = isPaid ? AI_PRO_INCLUDED_MONTHLY_CREDITS : AI_FREE_MONTHLY_CREDITS;

  return (
    <div className="mm">
      <JsonLd
        id="ai-credits-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
          { name: 'AI credits', path: '/pricing/ai-credits' },
        ])}
      />
      <JsonLd id="ai-credits-faq-json-ld" data={faqJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))} />
      <NavBar />

      <main>
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap mm-wrap--tight">
            <h1 className="mm-h1">AI credits</h1>
            <p className="mm-lead" style={{ marginTop: '1rem' }}>
              Ask Mobi uses AI credits for written replies: {AI_FREE_MONTHLY_CREDITS} a month on Free and {AI_PRO_INCLUDED_MONTHLY_CREDITS} on Pro, kept apart from Practice credits.
              {' '}{aiCreditsStatusLine({ checkoutOpen, repliesOpen: runtimeAiReleased() })}
            </p>

            {/* The balance: a signed-in student sees their own figures with their labels; a visitor gets one line. */}
            {wallet ? (
              wallet.known ? (
                <dl className="aic-balance">
                  <div><dt>Your balance</dt><dd>{wallet.total}<small>AI credits</small></dd></div>
                  <div><dt>Monthly included</dt><dd>{wallet.includedRemaining}<small>of {wallet.includedMonthlyCredits} left this month</small></dd></div>
                  <div><dt>Purchased</dt><dd>{wallet.bonusCredits}<small>never expire</small></dd></div>
                </dl>
              ) : <p className="aic-line" role="status">{wallet.message || 'Your AI credit balance could not be read just now.'}</p>
            ) : (
              <div className="aic-signin">
                <p className="aic-line">Log in to see your AI credits. A {isPaid ? 'Pro' : 'free'} account includes {monthly} a month.</p>
                <Link href="/login?callbackUrl=%2Fpricing%2Fai-credits" className="mm-btn mm-btn--primary">Log in</Link>
              </div>
            )}
          </div>
        </section>

        {/* Packs are listed only while checkout is open; paused packs never look purchasable. */}
        {checkoutOpen ? (
          <section className="mm-section">
            <div className="mm-wrap mm-wrap--tight">
              <h2 className="mm-h2">Buy AI credits</h2>
              <ul className="aic-rules">
                {AI_CREDIT_PACKS.map((pack) => (
                  <li key={pack.key} className="aic-pack">
                    <div>
                      <b>{pack.credits} credits, ₹{pack.amountInr} once</b>
                      <p>{pack.description} ₹{(pack.amountInr / pack.credits).toFixed(2)} a credit.</p>
                    </div>
                    <PrepOSCreditPurchaseButton pack={pack} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="mm-section mm-section--sunken" id="how-credits-work">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">How AI credits work</h2>
            <ul className="aic-rules">
              {aiCreditsRules(checkoutOpen).map(([title, body]) => (
                <li key={title}><b>{title}</b><p>{body}</p></li>
              ))}
            </ul>
            <p className="mm-body" style={{ marginTop: '1.25rem' }}>
              Your next step on Today never uses AI credits. <Link href="/pricing" className="mm-link">Compare Free and Pro</Link>{' '}
              <Link href="/wallet" className="mm-link">Open your wallet</Link>
            </p>
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Questions about AI credits</h2>
            <div className="mm-faqs">
              {faqs.map((faq) => (
                <details key={faq.q} className="mm-faq">
                  <summary>{faq.q}</summary>
                  <div className="mm-faq__body">{faq.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <style>{`
        .aic-back { margin: 0 0 1rem; font-size: 0.9375rem; }
        .aic-line { margin: 1.5rem 0 0; font-size: 1rem; line-height: 1.6; color: var(--ink-2); }
        .aic-signin { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; }
        .aic-signin .aic-line { flex: 1 1 280px; }
        .aic-signin .mm-btn { margin-top: 1.5rem; }
        .aic-balance { display: grid; grid-template-columns: minmax(0, 1fr); margin: 1.75rem 0 0; border-block: 1px solid var(--line); }
        .aic-balance > div { display: grid; gap: 0.25rem; padding: 1rem 0; }
        .aic-balance > div + div { border-top: 1px solid var(--line); }
        .aic-balance dt { font-size: 0.875rem; font-weight: 600; color: var(--ink-3); }
        .aic-balance dd { margin: 0; font: 700 1.75rem/1.1 var(--font-display); color: var(--ink); font-variant-numeric: tabular-nums; }
        .aic-balance dd small { display: block; margin-top: 0.25rem; font: 500 0.875rem/1.4 var(--font-body); color: var(--ink-3); }
        @media (min-width: 640px) {
          .aic-balance { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .aic-balance > div + div { border-top: 0; border-left: 1px solid var(--line); padding-left: 1.25rem; }
        }
        .aic-rules { list-style: none; margin: 1.25rem 0 0; padding: 0; border-bottom: 1px solid var(--line); }
        .aic-rules li { display: grid; gap: 0.25rem; padding: 1rem 0; border-top: 1px solid var(--line); }
        .aic-rules b { font: 700 1.0625rem/1.35 var(--font-display); color: var(--ink); }
        .aic-rules p { margin: 0; max-width: 62ch; font-size: 0.9375rem; line-height: 1.6; color: var(--ink-2); }
        .aic-pack { grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 1.5rem; }
      `}</style>
    </div>
  );
}
