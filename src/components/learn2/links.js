"use client";
// Where a Learn v2 link goes. Real app routes (BUILD-1101, behind NEXT_PUBLIC_LEARN2): /learn, /learn/find, /learn/c/<key>,
// /learn/c/<key>/cards, /learn/run, /explore/run. /learn/run and /explore/run are focus routes (no sidebar, top bar or dock).
// Inside the development preview the same links stay in the preview with its fixture flags, so a walk never leaves the fixtures.
// One hook, so no screen builds a URL by hand.
import { useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const KEEP = ['plan', 'data', 'decks', 'student', 'kcs', 'kcline', 'theme', 'nav', 'study'];

const enc = encodeURIComponent;
const query = (entries) => {
  const q = new URLSearchParams();
  for (const [k, v] of entries) if (v !== null && v !== undefined && v !== '' && v !== false) q.set(k, String(v));
  return q.toString();
};
const withQuery = (path, entries) => { const q = query(entries); return q ? `${path}?${q}` : path; };

/** The production href of a chapter run (the same string the preview's view encodes). */
export const runHref = ({ chapterKey = null, minutes = 10, kind = 'mix', leaveOut = [], cardIds = [], runId = null, end = false } = {}) => withQuery('/learn/run', [
  ['chapter', chapterKey], ['min', minutes], ['kind', kind], ['out', (leaveOut || []).join(',')], ['cards', (cardIds || []).join(',')], ['run', runId], ['end', end ? '1' : ''],
]);
/** The production href of a chapter feed. */
export const feedHref = ({ chapterKey = null, minutes = 10, runId = null, end = false } = {}) => withQuery('/explore/run', [['chapter', chapterKey], ['min', minutes], ['run', runId], ['end', end ? '1' : '']]);

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

  const links = {
    preview,
    home: (subject = null) => (preview ? previewHref('learn2', { subject }) : withQuery('/learn', [['subject', subject]])),
    find: (subject = null, text = null) => (preview ? previewHref('learn2', { subject, lv: 'find', q: text }) : withQuery('/learn/find', [['subject', subject], ['q', text]])),
    chapter: (key, minutes = null) => (preview ? previewHref('learn2-chapter', { chapter: key, min: minutes }) : withQuery(`/learn/c/${enc(key)}`, [['min', minutes]])),
    cards: (key, filter = null) => (preview ? previewHref('learn2-cards', { chapter: key, f: filter }) : withQuery(`/learn/c/${enc(key)}/cards`, [['f', filter]])),
    run: ({ chapterKey, minutes = 10, kind = 'mix', leaveOut = [], cardIds = [], runId = null, end = false }) => (preview
      ? previewHref('learn2-run', { chapter: chapterKey, min: minutes, kind, out: (leaveOut || []).join(','), cards: (cardIds || []).join(','), run: runId, end: end ? '1' : '' })
      : runHref({ chapterKey, minutes, kind, leaveOut, cardIds, runId, end })),
    feed: (key, minutes = 10, { runId = null, end = false } = {}) => (preview
      ? previewHref('learn2-feed', { chapter: key, min: minutes, run: runId, end: end ? '1' : '' })
      : feedHref({ chapterKey: key, minutes, runId, end })),
    explore: () => (preview ? previewHref('explore', {}) : '/explore'),
    lesson: (unitId) => (preview ? previewHref('learn2', {}) : `/learn/${enc(unitId)}`),
    revise: () => (preview ? previewHref('revise', { revise: 'keycards' }) : '/review/revise'),
  };

  // A production href the service wrote (an end screen's endHref: '/learn/run?run=<id>&end=1' or '/explore/run?run=<id>&end=1', a
  // suggestion's href) drawn for where the student is: the same string on the real site, the preview's own view in the preview.
  links.resolve = (href) => {
    if (!preview || !href || String(href).startsWith('/preview/')) return href;
    let url;
    try { url = new URL(href, 'http://x'); } catch { return href; }
    const get = (k) => url.searchParams.get(k);
    const path = url.pathname;
    if (path === '/learn/run') return links.run({ chapterKey: get('chapter') || undefined, minutes: Number(get('min')) || 10, kind: get('kind') || 'mix', leaveOut: (get('out') || '').split(',').filter(Boolean), cardIds: (get('cards') || '').split(',').filter(Boolean), runId: get('run'), end: get('end') === '1' });
    if (path === '/explore/run') return links.feed(get('chapter'), Number(get('min')) || 10, { runId: get('run'), end: get('end') === '1' });
    if (path === '/explore') return links.explore();
    if (path === '/learn/find') return links.find(get('subject'), get('q'));
    const cards = path.match(/^\/learn\/c\/([^/]+)\/cards$/);
    if (cards) return links.cards(decodeURIComponent(cards[1]), get('f'));
    const chapter = path.match(/^\/learn\/c\/([^/]+)$/);
    if (chapter) return links.chapter(decodeURIComponent(chapter[1]), get('min'));
    if (path === '/learn') return links.home(get('subject'));
    return href;
  };
  return links;
}
