import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';

// One plan card on /pricing. It reuses the .mm-plan styles. Unlike the shared PricingCard it carries
// no "Everything unlocked" flag: the card states what the plan includes, in numbers, and nothing else.
export function PlanCard({ plan, ctaElement = null }) {
  const { name, price, cycle, description, features = [], ctaLabel, ctaHref = '/signup', featured = false, footnote } = plan;
  return (
    <article className="mm-plan" data-featured={featured ? 'true' : 'false'}>
      <div className="mm-plan__head">
        <h3 className="mm-plan__name">{name}</h3>
        <p className="mm-plan__price mm-measure">
          {price}
          {cycle ? <span>{cycle}</span> : null}
        </p>
        <p className="mm-plan__desc">{description}</p>
      </div>

      <ul className="mm-plan__features">
        {features.map((feature) => (
          <li key={feature}>
            <Icon name="check" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mm-plan__cta">
        {ctaElement || (
          <Link href={ctaHref} className={`mm-btn ${featured ? 'mm-btn--primary' : 'mm-btn--secondary'}`}>
            {ctaLabel}
          </Link>
        )}
        {footnote ? <p className="mm-plan__footnote">{footnote}</p> : null}
      </div>
    </article>
  );
}
