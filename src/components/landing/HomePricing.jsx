import Link from 'next/link';
import { PlanCard } from '@/components/pricing/PlanCard';
import { PLAN_COPY } from '@/components/pricing/planOffer.mjs';
import { ProSealStrip } from '@/components/pricing/ProShowcase';
import { perMockTable, proToExam } from '@/lib/payments/value.mjs';
import { PRICE_COMPARISON } from '@/../data/price_comparison_1105.mjs';
import { PLAN_HOME, freeLine, planGroups, pricingHead } from './homeCopy.mjs';
import { Reveal } from './Reveal';
import { PlanCounts } from './PlanCounts';
import { PlanFree } from './PlanFree';
import { PlanValue } from './PlanValue';
import { PriceCompare } from './PriceCompare';
import '@/app/home-pricing.css';

// The home page's #pricing (R3-D7, R3-D8; owner LK107, LK109, LK110, LK111, LK112, 5 Nov 2026). The /pricing page's one plan
// ("One plan, everything in it", the shared PlanCard with its seal strip) as a glass card over a big "Pro", its lines grouped
// with the true counts the numbers band used to show (PlanCounts), Get Pro to the checkout on /pricing, and Free as one quiet
// line with Start free. Beside it (under it on phones): what a Full mock comes to at your own pace (PlanValue) and what Pro
// costs to CUET next to other CUET prep, dated and sourced (PriceCompare).
// Branches: the per-mock figures and the comparison count Full mocks as unlimited, which is Pro's promise only on the current
// offer, so they show while the new (recovery) offer is not released; monthly and one-time each get their own sentences
// (value.mjs), never one sentence for both. `from` is the date the page was built, for the one-time days and the months to CUET.
// `seat` is the section's Mobi seat (page.js keeps every seat in one place).
export function HomePricing({ offer, newOffer = false, firstFullMock = null, from = new Date(), seat = null }) {
  const head = pricingHead(offer);
  const table = newOffer ? [] : perMockTable(offer, { from });
  const toExam = newOffer ? null : proToExam(offer, { from, exam: PRICE_COMPARISON.exam });
  const side = table.length > 0 || toExam;
  return (
    <div className="mm-wrap lp-price">
      {seat}
      <Reveal className="lp-head lp-price__head">
        <h2 className="lp-h2">{head.h2}</h2>
        <p className="lp-sub">{head.sub}</p>
      </Reveal>
      <div className={`lp-price__grid${side ? '' : ' lp-price__grid--one'}`}>
        <div className="lp-price__stage">
          <p className="lp-price__word" aria-hidden="true">{PLAN_HOME.backdrop}</p>
          <PlanCard offer={offer} titleAs="h3" titleId="lp-plan-title" className="lp-plan" head={<ProSealStrip label={PLAN_COPY.label} />}>
            <PlanCounts groups={planGroups({ newOffer })} />
            <div className="lp-plan__go">
              <Link href="/pricing#plans" className="mm-btn mm-btn--primary">{PLAN_COPY.key}</Link>
              <Link href="/pricing" className="lp-plan__more">{PLAN_HOME.pricingLink}</Link>
            </div>
            <PlanFree line={freeLine({ firstFullMock })} cta={PLAN_HOME.freeCta} />
          </PlanCard>
        </div>
        {side ? (
          <div className="lp-price__side">
            {table.length ? <PlanValue table={table} /> : null}
            {toExam ? <PriceCompare pro={toExam} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default HomePricing;
