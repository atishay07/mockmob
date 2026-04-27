"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icons';

export function LandingActions({ mode = 'hero' }) {
  const { isAuthenticated } = useAuth();
  const primaryHref = isAuthenticated ? '/dashboard' : '/signup';
  const primaryText = isAuthenticated ? 'Enter Dashboard' : 'Start a free mock';

  if (mode === 'primary') {
    return (
      <Link href={primaryHref}>
        <Button variant="volt" size="lg" className="hover:scale-105 transition-transform">
          {isAuthenticated ? 'Enter Dashboard' : 'Join the Mob'} <Icon name="arrow" />
        </Button>
      </Link>
    );
  }

  return (
    <div className="mb-4 flex flex-col items-center gap-3">
      {!isAuthenticated && (
        <div className="font-display text-2xl font-extrabold text-white md:text-3xl">
          CUET UG 2026 starts here
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={primaryHref}>
          <Button variant="volt" size="lg">{primaryText} <Icon name="arrow" /></Button>
        </Link>
        {!isAuthenticated && (
          <Link href="/signup">
            <Button variant="outline" size="lg">Get Started <Icon name="arrow" /></Button>
          </Link>
        )}
        <Link href="/pricing">
          <Button variant="outline" size="lg">View Pricing <Icon name="arrow" /></Button>
        </Link>
      </div>
    </div>
  );
}
