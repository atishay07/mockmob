import React from 'react';
import Link from 'next/link';
import { Icon } from './Icons';

export function PricingCard({
  name,
  price,
  originalPrice,
  cycle = '/month',
  description,
  features = [],
  ctaLabel,
  ctaHref = '/signup',
  ctaElement,
  featured = false,
  footnote,
  terms = [],
  // The plan name's heading level: the Pro card sits right under the page's h1 (an h2 there), the Free card under its
  // own section heading (h3).
  headingLevel = 3,
}) {
  const Name = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="mm-plan" data-featured={featured ? 'true' : 'false'}>

      <div className="mm-plan__head">
        <Name className="mm-plan__name">{name}</Name>
        <p className="mm-plan__price mm-measure">
          {price}
          <span>{cycle}</span>
        </p>
        {originalPrice ? (
          <p className="mm-plan__was">
            Comparable test series <s>{originalPrice}</s>
          </p>
        ) : null}
        <p className="mm-plan__desc">{description}</p>
        {terms.length ? (
          <dl className="mm-plan__terms">
            {terms.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
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
          <Link
            href={ctaHref}
            className={`mm-btn ${featured ? 'mm-btn--primary' : 'mm-btn--secondary'}`}
          >
            {ctaLabel}
          </Link>
        )}
        {footnote ? <p className="mm-plan__footnote">{footnote}</p> : null}
      </div>
    </article>
  );
}
