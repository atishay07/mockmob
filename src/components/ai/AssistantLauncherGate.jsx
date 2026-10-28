"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// Route gate that ships no animation runtime of its own.
//
// AssistantLauncher pulls in motion/react, PrepOSOrb and AssistantDrawer at
// module scope. Mounted directly in the root layout it shipped that payload on
// every public marketing page, including the landing page where it renders
// nothing — unacceptable against the confirmed device floor of a budget
// Android on patchy 4G. This gate decides the route first and only then
// imports the real launcher.
const AssistantLauncher = dynamic(() => import('./AssistantLauncher'), { ssr: false });

// The launcher belongs to the authenticated app, whose dark system it was
// drawn for. It stays off every public marketing surface.
const OFF_PREFIXES = [
  '/auth/callback',
  '/signup',
  '/login',
  '/onboarding',
  '/verify-payment',
  '/pricing',
  '/features',
  '/about',
  '/contact',
  '/cuet',
  '/privacy',
  '/terms',
  '/refunds',
  '/test',
  '/preview/study',
];

export default function AssistantLauncherGate(props) {
  const pathname = usePathname();

  const isOff =
    pathname === '/' || OFF_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (isOff) return null;

  return <AssistantLauncher {...props} />;
}
