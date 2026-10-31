"use client";
// Where a Learn v2 link goes. Real app routes (after the owner approves the renders): /learn, /learn/find,
// /learn/c/<key>, /learn/c/<key>/cards, /learn/run, /explore/run. Inside the development preview the same links stay in
// the preview with its fixture flags, so a walk never leaves the fixtures. One hook, so no screen builds a URL by hand.
import { useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const KEEP = ['plan', 'data', 'decks', 'student', 'kcs', 'kcline', 'theme', 'nav', 'study'];

export function useLearnLinks() {
  const pathname = usePathname() || '';
  const params = useSearchParams();
  const preview = pathname.startsWith('/preview/');
  const previewHref = useCallback((view, extra = {}) => {
    const next = new URLSearchParams({ view });
    for (const k of KEEP) if (params?.get(k)) next.set(k, params.get(k));
    for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '') next.set(k, String(v));
    return `/preview/arena?${next.toString()}`;
  }, [params]);
  const enc = encodeURIComponent;
  return {
    preview,
    home: (subject = null) => (preview ? previewHref('learn2', { subject }) : subject ? `/learn?subject=${enc(subject)}` : '/learn'),
    find: (subject = null, query = null) => (preview ? previewHref('learn2', { subject, lv: 'find', q: query }) : `/learn/find?${new URLSearchParams(Object.entries({ subject, q: query }).filter(([, v]) => v))}`),
    chapter: (key, minutes = null) => (preview ? previewHref('learn2-chapter', { chapter: key, min: minutes }) : `/learn/c/${enc(key)}${minutes ? `?min=${minutes}` : ''}`),
    cards: (key, filter = null) => (preview ? previewHref('learn2-cards', { chapter: key, f: filter }) : `/learn/c/${enc(key)}/cards${filter ? `?f=${filter}` : ''}`),
    run: ({ chapterKey, minutes = 10, kind = 'mix', leaveOut = [] }) => (preview
      ? previewHref('learn2-run', { chapter: chapterKey, min: minutes, kind, out: leaveOut.join(',') })
      : `/learn/run?${new URLSearchParams({ chapter: chapterKey, min: String(minutes), kind, ...(leaveOut.length ? { out: leaveOut.join(',') } : {}) })}`),
    feed: (key, minutes = 10) => (preview ? previewHref('learn2-feed', { chapter: key, min: minutes }) : `/explore/run?chapter=${enc(key)}&min=${minutes}`),
    explore: () => (preview ? previewHref('explore', {}) : '/explore'),
    lesson: (unitId) => (preview ? previewHref('learn2', {}) : `/learn/${enc(unitId)}`),
    revise: () => (preview ? previewHref('revise', { revise: 'keycards' }) : '/review/revise'),
  };
}
