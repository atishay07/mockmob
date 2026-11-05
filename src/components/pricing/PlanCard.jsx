// The one plan's card, shared by /pricing (its checkout card, styled by src/app/pricing/pro-page.css) and the home page's
// #pricing (the glass card over the word "Pro", styled by src/app/home-pricing.css; R3-D8, owner LK109, 5 Nov 2026). Extracted
// unchanged from src/app/pricing/page.js: the title, the price the buyer is charged today (priceTag), the one line of terms
// and, while only one-time access is on sale, the monthly line. `head` draws above the title (the home card's seal strip),
// `children` below the terms (the /pricing checkout, or the home card's lines and keys). A server component with no state.
import { PLAN_COPY, planTerms, priceTag } from './planOffer.mjs';

export function PlanCard({ offer, titleAs: Title = 'h2', titleId, className = '', head = null, children = null }) {
  const tag = priceTag(offer);
  const terms = planTerms(offer);
  return (
    <div className={`pro-plan__card${className ? ` ${className}` : ''}`} data-commerce="">
      {head}
      <Title className="pro-plan__title" id={titleId}>{PLAN_COPY.plan}</Title>
      <p className="pro-plan__price"><span className="pro-plan__fig">{tag.price}</span> <span className="pro-plan__cycle">{tag.cycle}</span></p>
      <p className="pro-plan__renew">{terms.renew}</p>
      {terms.soon ? <p className="pro-plan__soon">{terms.soon}</p> : null}
      {children}
    </div>
  );
}

export default PlanCard;
