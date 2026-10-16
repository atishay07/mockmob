"use client";

// On phones the on-screen keyboard covers the lower half of the layout viewport, so a search field's
// results can end up hidden behind it. The visual viewport is the part the student can actually see:
// this hook publishes its height as --du-vv-h on the document (results use it for a max-height) and,
// while a search field is focused, keeps that field scrolled into the visible part as the keyboard opens.
// It listens on the document for any input marked data-du-search, so it works for fields that are only
// rendered after data has loaded. Mount it once per page that has such a field.
import { useEffect } from 'react';

export const DU_SEARCH_ATTR = 'data-du-search';

export function useAboveKeyboard() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    const isField = (el) => el instanceof HTMLElement && el.hasAttribute(DU_SEARCH_ATTR);
    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // How far down the sticky stack reaches: the nav alone (5.5rem), or the nav plus a sticky summary
    // bar (.du-sum, shown below 1100px once subjects are picked), measured where it sticks, plus a gap.
    const stickyClear = () => {
      const sum = document.querySelector('.du-sum');
      if (sum) {
        const cs = getComputedStyle(sum);
        if (cs.display !== 'none' && cs.position === 'sticky') return Math.round((parseFloat(cs.top) || 0) + sum.offsetHeight + 12);
      }
      return 88;
    };
    const reveal = () => {
      const field = document.activeElement;
      if (!isField(field)) return;
      const clear = stickyClear();
      root.style.setProperty('--du-vv-h', `${Math.round(vv.height)}px`);
      root.style.setProperty('--du-clear', `${clear}px`);
      const r = field.getBoundingClientRect();
      // Keep the field in the upper part of what is visible, below the sticky bars, so its results show below it, above the keyboard.
      if (r.top < clear || r.bottom > Math.max(vv.height * 0.45, clear + r.height + 4)) {
        field.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      }
    };
    const onFocusIn = (e) => { if (isField(e.target)) { reveal(); window.setTimeout(reveal, 320); } };
    const onFocusOut = (e) => { if (isField(e.target)) { root.style.removeProperty('--du-vv-h'); root.style.removeProperty('--du-clear'); } };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv.addEventListener('resize', reveal);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv.removeEventListener('resize', reveal);
      root.style.removeProperty('--du-vv-h');
      root.style.removeProperty('--du-clear');
    };
  }, []);
}
