export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { PublicHero } from '@/components/PublicPage';
import { Surface } from '@/components/ui/Card';
import { buttonClass } from '@/components/ui/Button';
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
import '../pricing.css';

export const metadata = seoMetadata({
  title: 'PrepOS Credits',
  description:
    'View your preserved PrepOS credits. New top-ups and paid model replies are paused pending spending and staging checks. Purchased credits do not expire.',
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
    a: 'Yes. Pro is billed separately from the optional PrepOS wallet. New top-ups are currently paused and existing balances are preserved.',
  },
];

const RULES = [
  ['Monthly first', 'Included Free and Pro credits spend before purchased credits.'],
  ['Never expire', 'Purchased credits stay until used.'],
  ['Separate from Pro', 'Top-ups do not change your subscription.'],
];

export default async function PrepOSPricingPage() {
  const session = await auth();
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const wallet = currentUser ? await readAIWallet(currentUser) : null;
  const isPaid = isPaidUser(currentUser);
  const checkoutOpen = aiCommerceOpen();
  // An unknown balance is never shown as a number, and never as 0.
  const figure = (value) => (wallet?.known ? value : 'Not available');

  return (
    <div className="mm">
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

      <main id="main-content" className="pp-pricing">
        <PublicHero
          tone="read"
          title="Your existing PrepOS wallet is preserved."
          lead={checkoutOpen
            ? `Free accounts include ${AI_FREE_MONTHLY_CREDITS} PrepOS credits a month and Pro includes ${AI_PRO_INCLUDED_MONTHLY_CREDITS}. Purchased credits are separate from practice credits.`
            : 'PrepOS paid features are temporarily unavailable. Your credits have not been used. New top-ups are paused; purchased credits are preserved and do not expire. Your next practice step on Today does not use PrepOS credits.'}
          meta={wallet && !wallet.known ? <span role="status">{wallet.message}</span> : null}
          crumbs={(
            <nav className="mm-crumbs" aria-label="Breadcrumb">
              <Link href="/pricing">Pricing</Link>
              <span aria-hidden="true">/</span>
              <span>PrepOS credits</span>
            </nav>
          )}
        >
          <Link href="/today" className={buttonClass({ variant: 'primary', size: 'lg' })}>Open your next step</Link>
          <a href="#prepos-credit-rules" className={buttonClass({ variant: 'secondary', size: 'lg' })}>How credits work</a>
        </PublicHero>

        <section className="pp-section" style={{ paddingTop: 'clamp(1.5rem, 4vw, 2.5rem)' }} aria-label="Your PrepOS credits">
          <div className="mm-wrap">
            <dl className="pp-metrics">
              <div>
                <dt>Your balance</dt>
                <dd>{wallet ? figure(wallet.total) : 'Log in'}</dd>
              </div>
              <div>
                <dt>Monthly included</dt>
                <dd>{wallet ? figure(`${wallet.includedRemaining} of ${wallet.includedMonthlyCredits}`) : isPaid ? AI_PRO_INCLUDED_MONTHLY_CREDITS : AI_FREE_MONTHLY_CREDITS}</dd>
              </div>
              <div>
                <dt>Purchased credits</dt>
                <dd>{wallet ? figure(wallet.bonusCredits) : 'Log in'}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Packs are listed only while checkout is open; paused packs never look purchasable. */}
        {checkoutOpen ? (
          <section id="prepos-plan-packs" className="pp-section" style={{ paddingTop: 0 }} aria-label="Credit packs">
            <div className="mm-wrap">
              <ul className="pp-packs">
                {AI_CREDIT_PACKS.map((pack) => (
                  <li key={pack.key}>
                    <Surface level={pack.featured ? 'focal' : 'raised'} className="pp-pack">
                      <div className="pp-pack__top">
                        <p className="pp-small">{pack.shortLabel}</p>
                        {pack.featured ? <span className="ui-tag ui-tag--accent">Best value</span> : null}
                      </div>
                      <h2 className="pp-pack__credits">{pack.credits} credits</h2>
                      <p className="pp-pack__desc">{pack.description}</p>
                      <div className="pp-pack__price">
                        <div>
                          <span className="pp-small">One-time</span>
                          <strong>₹{pack.amountInr}</strong>
                        </div>
                        <p className="pp-small">₹{(pack.amountInr / pack.credits).toFixed(2)} per credit</p>
                      </div>
                      <PrepOSCreditPurchaseButton pack={pack} />
                    </Surface>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section id="prepos-credit-rules" className="pp-section pp-section--sunken" aria-labelledby="prepos-rules-title">
          <div className="mm-wrap">
            <div className="pp-split">
              <div className="pp-split__head">
                <h2 id="prepos-rules-title" className="pp-h2">How credits work</h2>
                <div className="pp-actions">
                  <Link href="/pricing" className={buttonClass({ variant: 'secondary', size: 'lg' })}>Compare Free and Pro</Link>
                </div>
              </div>
              <dl className="pp-defs">
                {RULES.map(([title, body]) => (
                  <div key={title} className="pp-def">
                    <dt>{title}</dt>
                    <dd>{body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="prepos-faq-title">
          <div className="mm-wrap mm-wrap--tight">
            <h2 id="prepos-faq-title" className="pp-h2">PrepOS credit questions</h2>
            <div className="mm-faqs pp-faqs">
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
    </div>
  );
}
