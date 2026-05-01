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
      <Button asChild variant="volt" size="lg" className="hover:scale-105 transition-transform no-underline">
        <Link href={primaryHref}>
          {isAuthenticated ? 'Enter Dashboard' : 'Join the Mob'} <Icon name="arrow" />
        </Link>
      </Button>
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
        <Button asChild variant="volt" size="lg" className="no-underline">
          <Link href={primaryHref}>{primaryText} <Icon name="arrow" /></Link>
        </Button>
        {!isAuthenticated && (
          <Button asChild variant="outline" size="lg" className="no-underline">
            <Link href="/signup">Get Started <Icon name="arrow" /></Link>
          </Button>
        )}
        <Button asChild variant="outline" size="lg" className="no-underline">
          <Link href="/pricing">View Pricing <Icon name="arrow" /></Link>
        </Button>
      </div>
    </div>
  );
}
