export const dynamic = "force-dynamic";
import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PricingCard } from '@/components/ui/PricingCard';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    cycle: '/month',
    description: 'Perfect for getting started with focused mock practice.',
    ctaLabel: 'Start Free',
    features: ['3 mocks per week', 'Basic performance summary', 'Community leaderboard access', 'Question bank preview'],
  },
  {
    name: 'Pro',
    price: '₹399',
    cycle: '/month',
    description: 'For consistent aspirants who want sharper analytics.',
    ctaLabel: 'Go Pro',
    featured: true,
    features: ['Unlimited mocks', 'AI weakness radar', 'Chapter-level recommendations', 'Priority moderation credits'],
  },
  {
    name: 'Premium',
    price: '₹899',
    cycle: '/month',
    description: 'Built for top-rank chasers and study squads.',
    ctaLabel: 'Unlock Premium',
    features: ['Everything in Pro', 'Real-time squad rooms', 'Advanced rank simulations', 'Premium mock packs + exports'],
  },
];

export default function PricingPage() {
  return (
    <div className="view min-h-screen">
      <NavBar />
      <div className="container-wide px-5 pb-14 pt-[108px]">

        <section className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-volt/25 bg-volt/10 px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-volt" />
            <span className="mono-label !text-volt">No hidden fees</span>
          </div>
          <h1 className="display-lg mb-4">
            Pricing that keeps your <span className="text-volt italic">momentum</span> alive.
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-400">
            Start free, grow when you are ready, and keep every mock session focused on rank gains.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan, index) => (
            <PricingCard key={plan.name} {...plan} delay={index * 80} />
          ))}
        </section>

        <section className="mx-auto mt-12 max-w-3xl text-center">
          <p className="text-sm text-zinc-500">Need team or institute pricing? We can set it up in minutes.</p>
          <div className="mt-4 flex justify-center">
            <LiquidGlassButton asChild variant="ghost" size="md">
              <Link href="/signup">Talk to us</Link>
            </LiquidGlassButton>
          </div>
        </section>
      </div>
      <MarketingFooter />
    </div>
  );
}
