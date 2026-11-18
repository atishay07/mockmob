import Link from 'next/link';
import { Marked } from '@/components/doodle/Doodle';
import { PlanCard } from '@/components/pricing/PlanCard';
import { PlanStage } from '@/components/pricing/PlanStage';
import { PLAN_COPY } from '@/components/pricing/planOffer.mjs';
import { ProSealStrip } from '@/components/pricing/ProShowcase';
import { cardsBank, usualWay } from '@/lib/payments/receipt.mjs';
import { PLAN_HOME, freeLine, planGroups, pricingHead } from './homeCopy.mjs';
import { Reveal } from './Reveal';
import { DOCK_GO } from './demoSignal.mjs';
import { PlanCounts } from './PlanCounts';
import { PlanFree } from './PlanFree';
import { PlanValue } from './PlanValue';
import '@/app/home-pricing.css';

// The home page's #pricing (R3-D7, R3-D8; owner LK107, LK109, LK110, LK112; R4-H7, owner LK130-LK132, 5 Nov 2026; round 2 of
// 18 Nov 2026, lane home-b: "one card a student reads in one look: the price, what it buys as six objects, and the comparison
// as one line"; about 2,440 px on a phone before, now under 1,300 with nothing removed).
// The head: the h2 with its highlighter mark and the rate (pricingHead's parts, the price and the day's figure in the display
// face, read once by a screen reader); on a phone Mobi's seat sits small at the head's right (page.js keeps every seat in one
// place; r19-home-b.css places it), from 900 px he is the centred eyebrow over a centred head, as before.
// Then ONE card, the /pricing page's plan (PlanCard, shared) as glass on its stage under the big "Pro" (PlanStage, shared):
// its seal (ProSealStrip, laid out by home-scoped CSS: the foil seal in the card's top right, the "MockMob Pro" label as the
// card's first line), its name, the price as the card's largest figure and its own term lines, exactly as the offer gives
// them; then PlanValue draws the body: the six objects, the subject picker and the punch line, Get Pro, the two disclosures
// (the plan's grouped lines with their live counts, PlanCounts; how the usual price is worked out) and Free as one quiet line.
// Branch: the value grid and the comparison count Full mocks as unlimited, which is Pro's promise only on the current offer, so
// they show while the new (recovery) offer is not released and while the offer gives a figure; monthly and one-time each get
// their own sentences, never one sentence for both. `from` is the date the page was built. `keyCards` is the served Key cards
// bank (keyCardsDemo().bank) while Key cards are live, else null (no Key cards tile or line). The dated comparison with other
// CUET prep is gone (R4-H7, owner LK132: naming other platforms is a legal risk).
export function HomePricing({ offer, newOffer = false, firstFullMock = null, from = new Date(), keyCards = null, seat = null }) {
  const head = pricingHead(offer);
  // The plain offer the client needs to work the figures out (no plan ids), and the bank's two counts.
  const terms = { purchasable: offer.purchasable, monthly: { rupees: offer.monthly?.rupees }, oneTime: { rupees: offer.oneTime?.rupees, expires: offer.oneTime?.expires } };
  const bank = cardsBank(keyCards);
  const value = newOffer ? null : usualWay(terms);
  const go = (
    <div className="lp-plan__go">
      <Link href="/pricing#plans" className="mm-btn mm-btn--primary">{PLAN_COPY.key}</Link>
      <Link href="/pricing" className="lp-plan__more">{PLAN_HOME.pricingLink}</Link>
    </div>
  );
  return (
    <div className="mm-wrap lp-price">
      {seat}
      <Reveal className="lp-head lp-price__head">
        <h2 className="lp-h2"><Marked text={head.h2} marks={[['unlimited mocks.', { mark: 'highlight', tone: 'volt' }]]} /></h2>
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
      <div className="lp-price__grid lp-price__grid--one">
        <PlanStage word={PLAN_HOME.backdrop} className="lp-price__stage">
          <PlanCard offer={offer} titleAs="h3" titleId="lp-plan-title" className="lp-plan plan-glass" head={<ProSealStrip label={PLAN_COPY.label} />}>
            <PlanValue offer={terms} keyCards={Boolean(bank)} compare={Boolean(value)} go={go}
              everything={<PlanCounts groups={planGroups({ newOffer, keyCards: Boolean(bank) })} />}
              free={<PlanFree line={freeLine({ firstFullMock })} cta={DOCK_GO.label} />} />
          </PlanCard>
        </PlanStage>
      </div>
    </div>
  );
}

export default HomePricing;
