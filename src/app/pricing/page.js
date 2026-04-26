export const dynamic = "force-dynamic";
import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ChevronDown } from 'lucide-react';
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
    features: ['Credit-gated mocks', 'Weekly progress bar', '25 saved questions', 'Community leaderboard access'],
  },
  {
    name: 'Pro',
    price: '₹69',
    cycle: '/month',
    description: 'For consistent aspirants who want sharper analytics.',
    ctaLabel: 'Go Pro',
    featured: true,
    features: ['Unlimited mocks', 'Fast-lane mock generation', 'Unlimited bookmarks', 'Speed diagnostics + chapter recommendations'],
  }
];

const faqs = [
  {
    q: 'How does the Leaderboard work?',
    a: 'Every mock you take earns you XP based on your speed, accuracy, and difficulty of the questions. Your XP dictates your rank on the global leaderboard. Taking the daily "Mock Sprint" gives you a multiplier to help you climb faster.'
  },
  {
    q: 'What exactly is the AI Weakness Tracker?',
    a: 'Instead of only showing a raw score, the premium layer connects Arena attempts, Explore solves, bookmarks, and speed signals to show the chapters slowing you down.'
  },
  {
    q: 'Can I cancel my Pro plan anytime?',
    a: 'Absolutely. You can cancel your ₹69/month subscription at any time with no hidden fees or lock-in periods.'
  },
  {
    q: 'Are the community mocks reliable?',
    a: 'Yes! Every question uploaded by the community goes through an AI moderation pipeline and is peer-reviewed by top scorers. Questions with low ratings or incorrect keys are aggressively pruned from the active pool.'
  }
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

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <PricingCard key={plan.name} {...plan} delay={index * 80} />
          ))}
        </section>

        <section className="mx-auto mt-24 max-w-3xl text-left">
          <div className="text-center mb-10">
            <h2 className="display-md mb-2">Frequently Asked Questions</h2>
            <p className="text-zinc-400">Everything you need to know about MockMob</p>
          </div>
          
          <div className="flex flex-col gap-3">
            {faqs.map((faq, index) => (
              <details key={index} className="glass p-5 group [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer list-none font-display text-lg font-bold">
                  {faq.q}
                  <ChevronDown className="h-5 w-5 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-4 text-zinc-400 leading-relaxed text-sm">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl text-center">
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
