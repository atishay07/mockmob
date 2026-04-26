import React from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { LiquidGlassButton } from './LiquidGlassButton';

const pricingCardVariants = cva(
  [
    'glass relative flex h-full flex-col rounded-2xl p-6 md:p-7',
    'border transition-all duration-300 hover:-translate-y-1',
  ].join(' '),
  {
    variants: {
      tone: {
        default: 'border-white/10 bg-[rgba(255,255,255,0.015)] hover:border-white/25',
        featured:
          'border-volt/35 bg-[linear-gradient(160deg,rgba(210,240,0,0.08),rgba(255,255,255,0.02))] hover:border-volt/60',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

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
  delay = 0,
}) {
  return (
    <article className={pricingCardVariants({ tone: featured ? 'featured' : 'default' })} style={{ animationDelay: `${delay}ms` }}>
      {featured ? (
        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-volt/35 bg-volt/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-volt">
          <Sparkles className="h-3.5 w-3.5" />
          Most Popular
        </div>
      ) : null}

      <div className="mb-5">
        <h3 className="display-md text-[34px] leading-none">{name}</h3>
        <p className="mt-3 text-sm text-zinc-400">{description}</p>
      </div>

      <div className="mb-6">
        {originalPrice ? (
          <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
            <span className="font-medium">MRP</span>
            <span className="line-through decoration-zinc-500/80 decoration-2">{originalPrice}</span>
            <span>{cycle}</span>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <span className={`font-display text-[44px] font-extrabold leading-none ${featured ? 'text-volt' : 'text-white'}`}>{price}</span>
          <span className="pb-1 text-sm text-zinc-500">{cycle}</span>
        </div>
      </div>

      <ul className="mb-8 flex flex-1 flex-col gap-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-zinc-300">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? 'text-volt' : 'text-zinc-400'}`} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {ctaElement || (
        <LiquidGlassButton asChild size="lg" variant={featured ? 'volt' : 'ghost'} className="w-full">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </LiquidGlassButton>
      )}
    </article>
  );
}
