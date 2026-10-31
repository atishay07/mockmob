"use client";
// Where a Key cards link goes. On the real app: /cards, /cards/<chapter key>, /review/revise. Inside the development preview
// (/preview/arena) the same links stay in the preview with its fixture flags (plan, data, kc), so a walk never leaves the
// fixtures for real routes. One hook, so no screen builds a URL by hand.
import { useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const KEEP = ['plan', 'data', 'kc', 'revise', 'study', 'decks', 'student', 'kcs', 'kcline', 'kcfirst'];

export function useCardsLinks() {
  const pathname = usePathname() || '';
  const params = useSearchParams();
  const preview = pathname.startsWith('/preview/');
  const previewHref = useCallback((view, extra = {}) => {
    const next = new URLSearchParams({ view });
    for (const k of KEEP) if (params?.get(k)) next.set(k, params.get(k));
    for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined) next.set(k, v);
    return `/preview/arena?${next.toString()}`;
  }, [params]);
  return {
    preview,
    home: (subject = null) => (preview ? previewHref('cards', { subject }) : subject ? `/cards?subject=${encodeURIComponent(subject)}` : '/cards'),
    deck: (key, mode = null) => (preview ? previewHref('deck', { chapter: key, mode }) : `/cards/${encodeURIComponent(key)}${mode ? `?mode=${mode}` : ''}`),
    revise: () => (preview ? previewHref('revise', { revise: 'keycards' }) : '/review/revise'),
  };
}
