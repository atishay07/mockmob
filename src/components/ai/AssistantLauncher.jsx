"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { PrepOSOrb } from '@/components/ui/PrepOSOrb';
import { useAuth } from '@/components/AuthProvider';
import AssistantDrawer from './AssistantDrawer';

// The launcher belongs to the authenticated app, whose dark system it was
// drawn for. It stays off every public marketing surface: its glass pill and
// zero-offset volt halo are the exact vocabulary the marketing world replaced,
// and on /pricing it physically covered the plan features above the checkout.
const HIDDEN_PREFIXES = [
  '/coming-soon',
  '/preview/brand',
  '/preview/arena',
  '/explore',
  '/mentor',
  '/rival',
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
];
const PUBLIC_PREFIXES = ['/', '/features', '/pricing', '/privacy', '/terms', '/refunds'];

export default function AssistantLauncher({ compact = false, hidden = false }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { user, status } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isNarrow, setIsNarrow] = useState(true);
  const scrolledRef = useRef(false);

  const isTestRoute = pathname?.startsWith('/test');
  const isHiddenPath = HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const isPublicPath = pathname === '/' || PUBLIC_PREFIXES.some((prefix) => prefix !== '/' && pathname?.startsWith(prefix));
  const finalCompact = compact || isTestRoute || scrolled;
  // On phones the expanded pill is 272px wide and lands straight over the
  // landing drill, which is the first thing a visitor is meant to touch.
  // Narrow viewports keep the collapsed orb; desktop has room to expand.
  const expanded = !finalCompact && !open && !isNarrow;
  const nudge = useMemo(() => {
    if (status === 'authenticated' && user?.id) {
      return {
        bubble: 'Your next step, explained',
        title: 'PrepOS',
        line: 'Same step as Today',
      };
    }
    return {
      bubble: 'PrepOS explains your next step',
      title: 'Meet PrepOS',
      line: 'Ask about MockMob',
    };
  }, [status, user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const next = scrolledRef.current ? y > 32 : y > 128;
        if (next === scrolledRef.current) return;
        scrolledRef.current = next;
        setScrolled(next);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const isMarketingHome = pathname === '/';

  if (hidden || isTestRoute || isHiddenPath || isMarketingHome || (isNarrow && !isPublicPath) || (status === 'loading' && !isPublicPath)) {
    return null;
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={reduced ? undefined : { y: -2 }}
        style={{ width: expanded ? 282 : 62, right: 'max(16px, env(safe-area-inset-right))', bottom: 'max(16px, env(safe-area-inset-bottom))' }}
        className={`prepos-launcher arena-dark-island group fixed bottom-4 right-4 z-[70] inline-flex h-[62px] max-w-[calc(100vw-32px)] items-center rounded-full text-left md:bottom-5 md:right-6 ${
          expanded
            ? 'gap-3 border border-white/10 bg-[#0c0e09]/94 px-3 pr-4 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl hover:border-volt/35 hover:bg-[#11140b]'
            : 'justify-center bg-transparent p-0'
        }`}
        aria-label="Meet PrepOS, open the assistant"
      >
        {!open && !isNarrow ? (
          <motion.span
            initial={false}
            animate={{ opacity: expanded ? 1 : 0.92 }}
            className={`pointer-events-none absolute right-0 inline-flex max-w-[min(342px,calc(100vw-24px))] items-center rounded-full border border-volt/25 bg-[#0c0e09]/96 px-3 py-2 text-xs font-bold text-zinc-100 shadow-[0_12px_36px_rgba(0,0,0,0.36)] backdrop-blur-xl ${
              expanded ? '-top-11' : '-top-10'
            }`}
          >
            {expanded ? nudge.bubble : 'PrepOS'}
            <span className="absolute -bottom-1 right-8 h-2 w-2 rotate-45 border-b border-r border-volt/20 bg-[#0c0e09]" />
          </motion.span>
        ) : null}
        <span className="inline-flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full">
          <PrepOSOrb size={expanded ? 40 : 58} active={open || !expanded} />
        </span>
        {expanded ? (
          <motion.span
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="block min-w-0 pr-1"
          >
            <span className="flex min-w-0 items-center gap-2 font-display text-sm font-black text-zinc-50">
              <span className="h-1.5 w-1.5 rounded-full bg-volt shadow-[0_0_12px_rgba(210,240,0,0.55)]" />
              <span className="truncate">{nudge.title}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-zinc-500">
              {nudge.line}
            </span>
          </motion.span>
        ) : null}
      </motion.button>
      <AssistantDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
