import Link from 'next/link';
import { PlanCard } from '@/components/pricing/PlanCard';
import { PlanStage } from '@/components/pricing/PlanStage';
import { PLAN_COPY } from '@/components/pricing/planOffer.mjs';
import { ProSealStrip } from '@/components/pricing/ProShowcase';
import { receiptTable } from '@/lib/payments/receipt.mjs';
import { PLAN_HOME, freeLine, planGroups, pricingHead } from './homeCopy.mjs';
import { Reveal } from './Reveal';
import { PlanCounts } from './PlanCounts';
import { PlanFree } from './PlanFree';
import { PlanValue } from './PlanValue';
import '@/app/home-pricing.css';

// The home page's #pricing (R3-D7, R3-D8; owner LK107, LK109, LK110, LK112; R4-H7, owner LK130-LK132, 5 Nov 2026). The /pricing
// page's one plan ("One plan, everything in it", the shared PlanCard with its seal strip) as a glass card on its stage under a
// big "Pro" (PlanStage, shared with /pricing; R4: the card sits lower so most of the word shows), its lines grouped with the
// true counts (PlanCounts), Get Pro to the checkout on /pricing, and Free as one quiet line with Start free. Beside it (under it
// on phones): everything Pro's price covers at your own pace, as a receipt under one slider (PlanValue; round 5, owner 6 Nov
// 2026). The dated comparison with other CUET prep is gone (R4-H7, owner LK132: naming other platforms is a legal risk).
// Branch: the receipt counts Full mocks as unlimited, which is Pro's promise only on the current offer, so it shows while the
// new (recovery) offer is not released; monthly and one-time each get their own sentences, never one sentence for both. `from`
// is the date the page was built, for the one-time days. `keyCards` is the served Key cards bank (keyCardsDemo().bank) while
// Key cards are live, else null (no Key cards line). `seat` is the section's Mobi seat (page.js keeps every seat in one place).
export function HomePricing({ offer, newOffer = false, firstFullMock = null, from = new Date(), keyCards = null, seat = null }) {
  const head = pricingHead(offer);
  const rows = newOffer ? [] : receiptTable(offer, { from, keyCards });
  return (
    <div className="mm-wrap lp-price">
      {seat}
      <Reveal className="lp-head lp-price__head">
        <h2 className="lp-h2">{head.h2}</h2>
        <p className="lp-sub">{head.sub}</p>
      </Reveal>
      <div className={`lp-price__grid${rows.length ? '' : ' lp-price__grid--one'}`}>
        <PlanStage word={PLAN_HOME.backdrop} className="lp-price__stage">
          <PlanCard offer={offer} titleAs="h3" titleId="lp-plan-title" className="lp-plan plan-glass" head={<ProSealStrip label={PLAN_COPY.label} />}>
            <PlanCounts groups={planGroups({ newOffer })} />
            <div className="lp-plan__go">
              <Link href="/pricing#plans" className="mm-btn mm-btn--primary">{PLAN_COPY.key}</Link>
              <Link href="/pricing" className="lp-plan__more">{PLAN_HOME.pricingLink}</Link>
            </div>
            <PlanFree line={freeLine({ firstFullMock })} cta={PLAN_HOME.freeCta} />
          </PlanCard>
        </PlanStage>
        {rows.length ? (
          <div className="lp-price__side">
            <PlanValue rows={rows} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default HomePricing;
