export const dynamic = "force-dynamic";
import React from 'react';
import { CAPABILITIES } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { PlanCard } from '@/components/pricing/PlanCard';
import { CostTable } from '@/components/pricing/CostTable';
import { CreditsSection } from '@/components/pricing/CreditsSection';
import {
  UNLIMITED_NOTE,
  buildCostGroups,
  buildFaqs,
  buildPlans,
  offerView,
  pricingDescription,
  pricingHeading,
  pricingTitle,
} from '@/components/pricing/pricingContent';
import { RazorpayPaymentButton } from '@/components/billing/RazorpayPaymentButton';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { TODAY_HREF } from '@/lib/navigation';
import { AI_CREDIT_PACKS, aiCommerceOpen, readAIWallet } from '@/services/credits/aiCreditWallet';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';
import '@/app/public-polish.css';

export function generateMetadata() {
  const offer = publicOffer();
  return seoMetadata({
    title: pricingTitle(offer),
    description: pricingDescription(offer),
    path: '/pricing',
  });
}

export default async function PricingPage() {
  const session = await auth();
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const isPro = Boolean(currentUser?.isPremium);
  const wallet = currentUser ? await readAIWallet(currentUser) : null;
  const offer = publicOffer();
  const view = offerView(offer);
  // An item appears only while its capability is on; no screen says "not available".
  const repairOn = CAPABILITIES.mistakeRepair?.state === 'available';
  const askOn = CAPABILITIES.optionalAi?.state === 'available';
  const heading = pricingHeading(offer);
  const plans = buildPlans(offer, { signedIn: Boolean(currentUser), todayHref: TODAY_HREF });
  const groups = buildCostGroups({ repairOn, askOn });
  const faqs = buildFaqs(offer, { repairOn });
  const packs = aiCommerceOpen() ? AI_CREDIT_PACKS : [];

  return (
    <div className="mm mm-pricing">
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

      <main id="main-content">
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap">
            <h1 className="mm-h1">{heading.h1}</h1>
            <p className="mm-lead" style={{ marginTop: '1rem' }}>{heading.lead}</p>
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap">
            <div className="mm-plans">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  ctaElement={
                    plan.planId ? (
                      <RazorpayPaymentButton
                        planId={plan.planId}
                        amount={plan.amount}
                        label={plan.ctaLabel}
                        billing={plan.billing}
                        initialIsPremium={isPro}
                      />
                    ) : null
                  }
                />
              ))}
            </div>
          </div>
        </section>

        <CreditsSection
          wallet={wallet}
          practiceBalance={currentUser ? Number(currentUser.creditBalance) || 0 : null}
          isPro={isPro}
          repairOn={repairOn}
          askOn={askOn}
          packs={packs}
        />

        <section className="mm-section">
          <div className="mm-wrap">
            <h2 className="mm-h2">Free and Pro, line by line.</h2>
            <p className="mm-body mm-section__intro">
              Credits limit how often you practise. Answer explanations are free.
            </p>
            <CostTable groups={groups} />
            <p className="mm-small" style={{ marginTop: '1rem', maxWidth: '68ch' }}>{UNLIMITED_NOTE}</p>
          </div>
        </section>

        <section className="mm-section mm-section--sunken">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Questions people ask.</h2>
            <div className="mm-faqs">
              {faqs.map((faq) => (
                <details key={faq.q} className="mm-faq">
                  <summary>{faq.q}</summary>
                  <div className="mm-faq__body">{faq.a}</div>
                </details>
              ))}
            </div>
            <p className="mm-small" style={{ marginTop: '2rem' }}>
              Need team or institute pricing?{' '}
              <a className="mm-link" href="mailto:support@mockmob.in?subject=Team%20%2F%20institute%20pricing">
                Email us
              </a>{' '}
              and we will set it up.
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <MobileDock
        note={view.monthly ? `Pro ${view.priceText} a month. Cancel anytime.` : `${view.priceText} once, through ${view.expires}.`}
        label="Start free"
        href="/signup"
      />
    </div>
  );
}
