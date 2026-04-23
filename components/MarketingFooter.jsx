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
          <div className="flex gap-4 text-zinc-400">
            <a href="#" className="hover:text-volt transition-colors">
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
              </svg>
            </a>
            <a href="#" className="hover:text-volt transition-colors">
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
              </svg>
            </a>
            <a href="#" className="hover:text-volt transition-colors">
              <svg className="icon" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          </div>
        </div>
        <div>
          <div className="text-white font-display font-bold mb-4">Product</div>
          <ul className="flex flex-col gap-2 text-sm text-zinc-500">
            <li>
              <Link href="/" className="hover:text-volt">
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
              <span>CUET UG</span>
            </li>
            <li>
              <span>JEE Mains</span>
            </li>
            <li>
              <span>NEET UG</span>
            </li>
            <li>
              <span>UPSC Prelims</span>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-white font-display font-bold mb-4">Legal</div>
          <ul className="flex flex-col gap-2 text-sm text-zinc-500">
            <li>
              <span>Privacy Policy</span>
            </li>
            <li>
              <span>Terms of Service</span>
            </li>
            <li>
              <span>Refunds</span>
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

