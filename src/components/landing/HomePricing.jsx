import Link from 'next/link';
import { PlanCard } from '@/components/pricing/PlanCard';
import { PlanStage } from '@/components/pricing/PlanStage';
import { PLAN_COPY } from '@/components/pricing/planOffer.mjs';
import { ProSealStrip } from '@/components/pricing/ProShowcase';
import { cardsBank, usualWay } from '@/lib/payments/receipt.mjs';
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
// on phones), level with the card's top and as tall as the card: everything Pro's price covers at your own pace (PlanValue;
// round 5, second take, owner 6 Nov 2026: "both should be equally visible"). The dated comparison with other CUET prep is gone
// (R4-H7, owner LK132: naming other platforms is a legal risk).
// Branch: the value plan counts Full mocks as unlimited, which is Pro's promise only on the current offer, so it shows while the
// new (recovery) offer is not released and while the offer gives a figure; monthly and one-time each get their own sentences,
// never one sentence for both. `from` is the date the page was built, the one-time days' first count (PlanValue recounts them
// from the reader's own day). `keyCards` is the served Key cards bank (keyCardsDemo().bank) while Key cards are live, else null
// (no Key cards question or line). `seat` is the section's Mobi seat (page.js keeps every seat in one place): from 7 Nov 2026 an
// eyebrow centred above the head, his line in a speech bubble (brand-pip.css .pip-seat--eyebrow, .pip-seat--center).
// The head is centred at every width (owner, 7 Nov 2026: "overall formatting should be better, like center-aligned ... because
// it's a headline"; "all this text should not be just lying around randomly"): the h2, then the rate as one pill drawn from
// pricingHead's parts (the price and the day's figure in the display face, the day's in the brand colour), its whole sentence
// read once by a screen reader. Nothing sits under the pill (R8 PRICE-06): the monthly line is said once, in the card.
export function HomePricing({ offer, newOffer = false, firstFullMock = null, from = new Date(), keyCards = null, seat = null }) {
  const head = pricingHead(offer);
  // The plain offer the client needs to work the figures out (no plan ids), and the bank's two counts.
  const terms = { purchasable: offer.purchasable, monthly: { rupees: offer.monthly?.rupees }, oneTime: { rupees: offer.oneTime?.rupees, expires: offer.oneTime?.expires } };
  const bank = cardsBank(keyCards);
  const value = newOffer ? null : usualWay(terms);
  return (
    <div className="mm-wrap lp-price">
      {seat}
      <Reveal className="lp-head lp-price__head">
        <h2 className="lp-h2">{head.h2}</h2>
        <p className="lp-price__rate">
          <span className="lp-sr">{head.rateText}</span>
          <span aria-hidden="true">
            {head.rate.map((part, i) => (part.figure
              ? <b key={i} className={part.accent ? 'lp-price__fig lp-price__fig--accent' : 'lp-price__fig'}>{part.text}</b>
              : <span key={i}>{part.text}</span>))}
          </span>
        </p>
        {head.note ? <p className="lp-price__soon">{head.note}</p> : null}
      </Reveal>
      <div className={`lp-price__grid${value ? '' : ' lp-price__grid--one'}`}>
        <PlanStage word={PLAN_HOME.backdrop} className="lp-price__stage">
          <PlanCard offer={offer} titleAs="h3" titleId="lp-plan-title" className="lp-plan plan-glass" head={<ProSealStrip label={PLAN_COPY.label} />}>
            <PlanCounts groups={planGroups({ newOffer, keyCards: Boolean(bank) })} />
            <div className="lp-plan__go">
              <Link href="/pricing#plans" className="mm-btn mm-btn--primary">{PLAN_COPY.key}</Link>
              <Link href="/pricing" className="lp-plan__more">{PLAN_HOME.pricingLink}</Link>
            </div>
            <PlanFree line={freeLine({ firstFullMock })} cta={PLAN_HOME.freeCta} />
          </PlanCard>
        </PlanStage>
        {value ? (
          <div className="lp-price__side lp-price__side--full">
            <PlanValue offer={terms} keyCards={Boolean(bank)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default HomePricing;
