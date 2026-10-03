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
}) {
  return (
    <article className="mm-plan" data-featured={featured ? 'true' : 'false'}>
      {featured ? <p className="mm-plan__flag">Everything unlocked</p> : null}

      <div className="mm-plan__head">
        <h3 className="mm-plan__name">{name}</h3>
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
