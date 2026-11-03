'use client';
// Pure helpers and one hook shared by the Cards view, Find and the feed (Learn v2, DESIGN-SPEC A2, A5, A6).
import { useCallback, useState } from 'react';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { addToRevise, isProRequired, refreshHome } from '@/components/keycards/api';

/** The NCERT line on one line of text: line breaks become spaces. */
export const flat = (text) => String(text || '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The words of a search that count as a match (2 or more characters), as one case-insensitive pattern, or null. */
export function hitPattern(query) {
  const words = [...new Set(String(query || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length);
  return words.length ? new RegExp(`(${words.map(escapeRe).join('|')})`, 'gi') : null;
}

/** [{ text, hit }] with every match of the query marked. Without a query: one part. */
export function hitParts(text, query) {
  const s = String(text || '');
  const re = hitPattern(query);
  if (!re || !s) return [{ text: s, hit: false }];
  // A split with one capture group alternates text, match, text, ...: the parity is read before the empty pieces go.
  return s.split(re).map((p, i) => ({ text: p, hit: i % 2 === 1 })).filter((p) => p.text !== '');
}

/** The line around the first match, cut at word edges, with a leading and a trailing ellipsis where it was cut. */
export function snippet(text, query, max = 190) {
  const s = flat(text);
  if (s.length <= max) return s;
  const re = hitPattern(query);
  const at = re ? s.search(new RegExp(re.source, 'i')) : -1;
  let start = at > 50 ? at - 50 : 0;
  if (start > 0) { const sp = s.indexOf(' ', start); start = sp > 0 && sp < at ? sp + 1 : start; }
  let end = Math.min(s.length, start + max);
  if (end < s.length) { const sp = s.lastIndexOf(' ', end); end = sp > start + 40 ? sp : end; }
  return `${start > 0 ? '…' : ''}${s.slice(start, end).trim()}${end < s.length ? '…' : ''}`;
}

const SMALL = new Set(['and', 'of', 'the', 'in', 'for']);
/** "business_studies" as the name a student reads. */
export const subjectLabel = (id) => String(id || '').split(/[_-]/).filter(Boolean).map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

/** A link with extra query values, so a screen never builds a Learn URL by hand (links.js does that). */
export function withParams(href, extra = {}) {
  const [path, query = ''] = String(href).split('?');
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '') params.set(k, String(v));
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

/** One run takes at most this many picked or filtered cards (the server's cap). */
export const RUN_CARDS_MAX = 100;

export const countWord = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The picked set as a hook: toggle, clear, and whether pick mode is on (it stays on while anything is picked). */
export function usePick() {
  const [mode, setMode] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const toggle = useCallback((id) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const clear = useCallback(() => { setPicked(new Set()); }, []);
  const stop = useCallback(() => { setPicked(new Set()); setMode(false); }, []);
  return { mode: mode || picked.size > 0, setMode, picked, toggle, clear, stop };
}

/**
 * Add to Revise for one card or a picked set (POST /api/keycards/add). Pro adds single cards; a Free student reaches the
 * one Pro sheet here, at a real limit. `added` holds what this visit added, so rows show "In Revise" at once.
 */
export function useAddToRevise({ isPro, onAdded } = {}) {
  const [added, setAdded] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState(null);
  const [error, setError] = useState(null);
  const add = useCallback(async (ids, opener = null) => {
    const list = [...ids];
    if (!list.length) return false;
    if (!isPro) { openUpgrade({ trigger: 'keycards', opener }); return false; }
    setBusy(true); setError(null); setSaid(null);
    try {
      await addToRevise({ cardIds: list });
      setAdded((prev) => new Set([...prev, ...list]));
      setSaid(list.length === 1 ? 'Added to Revise.' : `${list.length} cards added to Revise.`);
      refreshHome();
      onAdded?.(list);
      return true;
    } catch (e) {
      if (isProRequired(e)) openUpgrade({ trigger: 'keycards', opener });
      else setError("The cards weren't added. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [isPro, onAdded]);
  return { added, busy, said, error, add };
}
