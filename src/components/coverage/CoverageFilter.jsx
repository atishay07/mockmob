'use client';

// The coverage page's one script (owner LK368, 22 Nov 2026): All, In MockMob, Not yet, and a chapter, applied to the palette
// and the question cards already in the page (each carries data-g, its group, and data-ch, its chapter's index). It also opens
// a question's card when its number is tapped in the palette (or the address names it), since a link to a closed card would
// only scroll to its row. Without script every question simply shows, and the numbers still jump.
import { useCallback, useEffect, useState } from 'react';
import { SUBJECT as copy } from './coverageCopy.mjs';

const openFromHash = () => {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!/^q\d+$/.test(id)) return;
  const card = document.getElementById(id);
  if (card && card.tagName === 'DETAILS') card.open = true;
};

export default function CoverageFilter({ rootId, chapters, total }) {
  const [group, setGroup] = useState('all');
  const [chapter, setChapter] = useState('');
  const [shown, setShown] = useState(total);

  const apply = useCallback((g, ch) => {
    const root = document.getElementById(rootId);
    if (!root) return;
    let cards = 0;
    for (const el of root.querySelectorAll('[data-cq]')) {
      const hide = (g !== 'all' && el.dataset.g !== g) || (ch !== '' && el.dataset.ch !== ch);
      el.hidden = hide;
      if (!hide && el.tagName === 'DETAILS') cards += 1;
    }
    setShown(cards);
  }, [rootId]);

  const pickGroup = (g) => { setGroup(g); apply(g, chapter); };
  const pickChapter = (ch) => { setChapter(ch); apply(group, ch); };

  useEffect(() => {
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    const root = document.getElementById(rootId);
    const onClick = (e) => {
      const a = e.target.closest?.('a[href^="#q"]');
      if (!a) return;
      const card = document.getElementById(a.getAttribute('href').slice(1));
      if (card && card.tagName === 'DETAILS') card.open = true;
    };
    root?.addEventListener('click', onClick);
    return () => { window.removeEventListener('hashchange', openFromHash); root?.removeEventListener('click', onClick); };
  }, [rootId]);

  const groups = [['all', copy.filterAll], ['in', copy.filterIn], ['not', copy.filterNot]];
  return (
    <div className="cov-filter">
      <div className="cov-seg" role="group" aria-label="Show">
        {groups.map(([id, label]) => (
          <button key={id} type="button" className="cov-seg__btn" aria-pressed={group === id} onClick={() => pickGroup(id)}>{label}</button>
        ))}
      </div>
      <label className="cov-select">
        <span className="cov-select__label">{copy.chapterLabel}</span>
        <select value={chapter} onChange={(e) => pickChapter(e.target.value)}>
          <option value="">{copy.chapterAll}</option>
          {chapters.map((c) => <option key={c.i} value={String(c.i)}>{c.name}</option>)}
        </select>
      </label>
      <p className="cov-filter__count" aria-live="polite">{copy.showing(shown, total)}</p>
    </div>
  );
}
