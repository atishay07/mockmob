import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 pt-16 pb-8 px-5">
      <div className="container-wide grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
        <div className="col-span-2 md:col-span-2">
          <Logo className="mb-4" />
          <p className="text-zinc-500 text-sm max-w-xs mb-6">
            India&apos;s first community-driven mock platform. Because solving alone is boring, and boring doesn&apos;t clear
            cutoffs.
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
            CUET-first. Independent. Built for serious practice.
          </p>
        </div>
        <div>
          <div className="text-white font-display font-bold mb-4">Product</div>
          <ul className="flex flex-col gap-2 text-sm text-zinc-500">
            <li>
              <Link href="/features" className="hover:text-volt">
                Features
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-volt">
                Get Started
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-volt">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/cuet-practice-tests-online" className="hover:text-volt">
                CUET Practice Tests
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-volt">
                Login
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-white font-display font-bold mb-4">Exams</div>
          <ul className="flex flex-col gap-2 text-sm text-zinc-500">
            <li>
              <Link href="/cuet-mock-test-free" className="hover:text-volt">
                CUET Mock Test Free
              </Link>
            </li>
            <li>
              <Link href="/cuet-previous-year-questions" className="hover:text-volt">
                CUET PYQs
              </Link>
            </li>
            <li>
              <Link href="/cuet-practice-tests-online" className="hover:text-volt">
                CUET Online Practice
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-white font-display font-bold mb-4">Legal</div>
          <ul className="flex flex-col gap-2 text-sm text-zinc-500">
            <li>
              <Link href="/privacy" className="hover:text-volt">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-volt">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/refunds" className="hover:text-volt">
                Refunds
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container-wide text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} MockMob Inc. All rights reserved. Not affiliated with NTA.
      </div>
    </footer>
  );
}
