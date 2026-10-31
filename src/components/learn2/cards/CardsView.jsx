'use client';
// The chapter's Cards view (DESIGN-SPEC A2 and A5, B 3.7): the new home of Read, with Quick recap folded in.
//   Head      Back to the chapter, "Key cards", the chapter's reference and card count
//   Filters   All, Must-know, In Revise, Missed lately, with real counts: one row of chips, one sliding indicator in the ink fill
//             (a phone's row scrolls sideways); volt stays on the Study key
//   Tools     "Show answers" (folded by default), Sections (a phone's jump list), Pick
//   Keys      for a filtered set: "Quick recap these 12" (one at a time, answers showing, nothing scheduled) and the one volt key
//             "Study these 12" (ratings join Revise); with no filter: "Study these 46"
//   List      grouped by NCERT section in book order, sticky section bars; a row opens in place (CardList)
//   Pick      "8 picked  Study these 8  Add to Revise  Clear"
// 1440: a 240 px sticky section list on the left, the list in a 680 px column. Free: the open cards in full and one locked line.
// States: loading (the whole page at its final shape, so nothing moves when the data lands), empty filter, error. Data: GET /api/learn/cards (learn2/api.js).
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { ErrorState } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { ncertFont } from '@/components/keycards/ncertFont';
import { chapterCards, useLearnRead } from '../api';
import { useLearnLinks } from '../links';
import CardList, { visibleSections } from './CardList';
import { RUN_CARDS_MAX, countWord, subjectLabel, useAddToRevise, usePick, withParams } from './cardsShared';
import '@/components/keycards/keycards.css';
import './cards.css';

const FILTERS = ['all', 'must', 'revise', 'missed'];
const EMPTY = {
  must: ['No Must-know cards in this chapter.', 'Every card here is a good one to know; none is marked Must-know yet.'],
  revise: ['No cards from this chapter are in Revise yet.', 'Rate a card in a run and it joins.'],
  missed: ['No missed cards in the last 14 days.', 'A card you miss in a run shows here until you get it right.'],
  all: ['No cards for this chapter yet.', 'Cards are written from the NCERT book and checked before they open here.'],
};

export function Skeleton({ groups = 2 }) {
  return (
    <div className="l2c-skel" role="status" aria-label="Loading the cards">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g}>
          <span className="skeleton l2c-skel__bar" />
          {[0, 1, 2].map((i) => <div key={i} className="l2c-skel__row"><span className="skeleton" /><span className="skeleton" /></div>)}
        </div>
      ))}
    </div>
  );
}

/** The page before its data: the title, the chips, the key and the first rows at the size they will have. */
function Loading({ back }) {
  return (
    <div className={`kc l2c ${ncertFont.variable}`}>
      <div className="l2c-layout">
        {back}
        <div className="l2c-main" aria-busy="true">
          <header className="l2c-head">
            <h1 className="l2c-title">Key cards</h1>
            <p className="l2c-ref"><span className="skeleton" style={{ display: 'block', width: 184, height: 18 }} /></p>
          </header>
          <div className="l2c-skel__chips" aria-hidden="true">{[56, 118, 104, 128].map((w) => <span key={w} className="skeleton" style={{ width: w }} />)}</div>
          <div className="l2c-tools" aria-hidden="true"><span className="skeleton" style={{ width: 168, height: 24 }} /></div>
          <div className="l2c-keys" aria-hidden="true"><span className="skeleton" style={{ width: 168, height: 44, borderRadius: 14 }} /></div>
          <Skeleton groups={2} />
        </div>
      </div>
    </div>
  );
}

/** The four filters as one row of chips. The ink indicator slides to the chosen chip; a phone's row scrolls and fades at its edge. */
export function FilterChips({ value, onChange, options, label = 'Which cards' }) {
  const box = useRef(null);
  const refs = useRef({});
  const [ind, setInd] = useState(null);
  const [more, setMore] = useState(false);
  const [ready, setReady] = useState(false);
  const sig = options.map((o) => `${o.value}${o.count}`).join('|');
  const measure = useCallback(() => {
    const el = refs.current[value];
    const c = box.current;
    if (!el || !c) return;
    setInd((cur) => (cur && cur.x === el.offsetLeft && cur.w === el.offsetWidth ? cur : { x: el.offsetLeft, w: el.offsetWidth }));
    setMore(c.scrollLeft + c.clientWidth < c.scrollWidth - 2);
  }, [value]);
  useLayoutEffect(() => { measure(); }, [measure, sig]);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [measure]);
  const pick = (v) => {
    const c = box.current; const el = refs.current[v];
    if (c && el) {
      let still = false;
      try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* smooth */ }
      const gut = 16;
      if (el.offsetLeft - gut < c.scrollLeft) c.scrollTo({ left: Math.max(0, el.offsetLeft - gut), behavior: still ? 'auto' : 'smooth' });
      else if (el.offsetLeft + el.offsetWidth + gut > c.scrollLeft + c.clientWidth) c.scrollTo({ left: el.offsetLeft + el.offsetWidth + gut - c.clientWidth, behavior: still ? 'auto' : 'smooth' });
    }
    onChange(v);
  };
  return (
    <div className="l2c-chips" role="group" aria-label={label} ref={box} data-more={more || undefined} data-ready={ready || undefined} onScroll={measure}>
      <span className="l2c-chips__ind" aria-hidden="true" style={ind ? { '--x': `${ind.x}px`, '--w': `${ind.w}px` } : undefined} />
      {options.map((o) => (
        <button key={o.value} type="button" className="l2c-chip" aria-pressed={value === o.value} ref={(el) => { if (el) refs.current[o.value] = el; }} onClick={() => pick(o.value)}>
          {o.label}<span className="l2c-n">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

/** The section list: a sticky column at 1440, and the phone's "Sections" popover. */
export function Rail({ sections, current, onGo, heading = 'Sections' }) {
  if (sections.length < 2) return null;
  return (
    <nav className="l2c-rail" aria-label={heading}>
      <p className="l2c-rail__h">{heading}</p>
      <ul className="l2c-rail__list">
        {sections.map((s) => (
          <li key={s.id}><button type="button" className="l2c-rail__item" aria-current={current === s.id || undefined} onClick={() => onGo(s.id)}><span>{s.title}</span><span>{s.count}</span></button></li>
        ))}
      </ul>
    </nav>
  );
}

export function Jump({ sections, onGo, label = 'Sections' }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const panel = useId();
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown') { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus(); } return; }
      if (!box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  if (sections.length < 2) return null;
  return (
    <span className="l2c-jump l2c-jumpbtn" ref={box}>
      <button type="button" className="kc-btn kc-btn--quiet" aria-expanded={open} aria-controls={open ? panel : undefined} onClick={() => setOpen((o) => !o)}>{label}<ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" /></button>
      {open ? (
        <div className="l2c-jump__panel" id={panel} role="group" aria-label={label === 'Chapters' ? 'Jump to a chapter' : 'Jump to a section'}>
          {sections.map((s) => <button key={s.id} type="button" className="l2c-jump__item" onClick={() => { setOpen(false); onGo(s.id); }}><span>{s.title}</span><span>{s.count}</span></button>)}
        </div>
      ) : null}
    </span>
  );
}

/** Scrolls a section bar into view under the top bar (smooth unless the student asked for less motion). */
export function goToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  let still = false;
  try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* smooth */ }
  el.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
}

/** Which section bar is the current one: the last whose top has passed the top bar. */
export function useCurrentSection(sections) {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (!sections.length) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      let at = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 140) at = s.id;
      }
      setCurrent(at);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [sections]);
  return current;
}

export function PickBar({ count, onStudy, onAdd, adding, onClear, studyHref }) {
  return (
    <div className="l2c-bar" role="region" aria-label="Picked cards">
      <p className="l2c-bar__n" role="status">{count} picked</p>
      <button type="button" className="kc-btn kc-btn--quiet l2c-bar__clear" onClick={onClear}>Clear</button>
      <div className="l2c-bar__keys">
        <Link className="kc-btn kc-btn--volt kc-btn--small" href={studyHref} onClick={onStudy}>Study these {count}</Link>
        <button type="button" className="kc-btn kc-btn--line kc-btn--small" disabled={adding} onClick={(e) => onAdd(e.currentTarget)}>Add to Revise</button>
      </div>
    </div>
  );
}

export default function CardsView({ chapterKey, filter: initialFilter = 'all' }) {
  const links = useLearnLinks();
  const search = useSearchParams();
  const openId = search?.get('open') || null;
  const [filter, setFilterState] = useState(FILTERS.includes(initialFilter) ? initialFilter : 'all');
  const [showAnswers, setShowAnswers] = useState(false);
  const pick = usePick();
  const read = useLearnRead(() => chapterCards({ chapter: chapterKey, filter }), [chapterKey, filter]);
  const data = read.data;
  const isPro = data?.plan === 'pro';
  const actions = useAddToRevise({ isPro, onAdded: () => read.refresh() });

  const setFilter = useCallback((f) => {
    setFilterState(f);
    pick.stop();
    try { const u = new URL(window.location.href); if (f === 'all') u.searchParams.delete('f'); else u.searchParams.set('f', f); window.history.replaceState(window.history.state, '', u); } catch { /* the URL keeps the old filter */ }
  }, [pick]);

  const [sections, setSections] = useState([]);
  const current = useCurrentSection(sections);
  const visible = useMemo(() => visibleSections(data?.sections, data?.lockedLine), [data]);
  const ids = useMemo(() => visible.flatMap((g) => g.cards.map((c) => c.id)), [visible]);
  const counts = data?.counts || { all: 0, must: 0, revise: 0, missed: 0 };
  const n = ids.length;
  const runIds = ids.slice(0, RUN_CARDS_MAX);
  const runCount = runIds.length;

  // Every key passes the cards it names (at most 100), so "Study these 46" plays those 46 and not a ten-minute pick (A3-04).
  const studyOne = useCallback((card) => links.run({ chapterKey, minutes: 10, kind: 'cards', cardIds: [card.id] }), [links, chapterKey]);
  const setStudy = links.run({ chapterKey, minutes: 10, kind: 'cards', cardIds: runIds });
  const recap = links.run({ chapterKey, minutes: 3, kind: 'recap', cardIds: runIds });
  const pickedIds = [...pick.picked].filter((id) => ids.includes(id));
  const pickStudy = links.run({ chapterKey, minutes: 10, kind: 'cards', cardIds: pickedIds.slice(0, RUN_CARDS_MAX) });

  const back = (
    <Link className="kc-back l2c-back" href={links.chapter(chapterKey)}><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" /><span>{data?.chapter?.title || 'Chapter'}</span></Link>
  );
  const shell = (body) => <div className={`kc l2c ${ncertFont.variable}`}><div className="l2c-layout">{back}<div className="l2c-main">{body}</div></div></div>;

  if (read.status === 'loading') return <Loading back={back} />;
  if (read.status === 'error' || !data) return shell(<ErrorState title="The cards did not load" message="Check your connection and try again. Nothing you added is lost." onRetry={read.refresh} />);

  const options = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'must', label: 'Must-know', count: counts.must },
    { value: 'revise', label: 'In Revise', count: counts.revise },
    { value: 'missed', label: 'Missed lately', count: counts.missed },
  ];
  const locked = data.lockedCount || 0;
  const free = !isPro && locked > 0;
  const empty = !n;
  const headLine = [subjectLabel(String(chapterKey).split('.')[0]), data.chapter?.ref, free ? `${counts.all} of ${counts.all + locked} cards open on Free` : countWord(counts.all, 'card')].filter(Boolean).join(', ');
  const showPickBar = pick.mode && pickedIds.length > 0;

  return (
    <div className={`kc l2c ${ncertFont.variable}`} data-pick={pick.mode || undefined}>
      <div className="l2c-layout">
        {back}
        <Rail sections={sections} current={current} onGo={goToSection} />
        <div className="l2c-main">
          <header className="l2c-head">
            <h1 className="l2c-title">Key cards</h1>
            <p className="l2c-ref">{headLine}</p>
          </header>

          <FilterChips value={filter} onChange={setFilter} options={options} />

          <div className="l2c-tools">
            <label className="l2c-switch">
              <Switch checked={showAnswers} onChange={setShowAnswers} aria-label="Show answers" />
              <span aria-hidden="true">Show answers</span>
            </label>
            <Jump sections={sections} onGo={goToSection} />
            <button type="button" className="kc-btn kc-btn--quiet" aria-pressed={pick.mode} aria-label={pick.mode ? 'Done picking' : 'Pick cards'} onClick={() => (pick.mode ? pick.stop() : pick.setMode(true))}>{pick.mode ? 'Done' : 'Pick'}</button>
          </div>

          {n > 0 ? (
            <div className="l2c-keys">
              {filter !== 'all' ? <Link className="kc-btn kc-btn--line kc-btn--small" href={recap}>Quick recap these {runCount}</Link> : null}
              <Link className={showPickBar ? 'kc-btn kc-btn--line kc-btn--small' : 'kc-btn kc-btn--volt kc-btn--small'} href={setStudy} data-page-primary={showPickBar ? undefined : ''}>{n > RUN_CARDS_MAX ? `Study the first ${RUN_CARDS_MAX}, in book order` : `Study these ${runCount}`}</Link>
            </div>
          ) : null}
          {actions.said ? <p className="l2c-said" role="status">{actions.said}</p> : null}
          {actions.error ? <p className="kc-err" role="alert">{actions.error}</p> : null}

          {empty ? (
            <div className="l2c-empty"><h2>{EMPTY[filter][0]}</h2><p>{EMPTY[filter][1]}</p></div>
          ) : (
            <div className={read.status === 'refreshing' ? 'l2c-refreshing' : undefined} key={filter}>
              <CardList
                sections={data.sections}
                lockedLine={data.lockedLine}
                isPro={isPro}
                showAnswers={showAnswers}
                pickMode={pick.mode}
                picked={pick.picked}
                onPick={pick.toggle}
                addedIds={actions.added}
                onAdd={(cardIds, opener) => actions.add(cardIds, opener)}
                adding={actions.busy}
                studyHref={studyOne}
                hideTags={filter === 'all' ? [] : [filter]}
                compact={filter !== 'all'}
                initialOpen={openId}
                onSections={setSections}
              />
            </div>
          )}
        </div>
      </div>
      {showPickBar ? (
        <PickBar count={pickedIds.length} studyHref={pickStudy} adding={actions.busy} onClear={pick.clear} onAdd={async (opener) => { const ok = await actions.add(pickedIds, opener); if (ok) pick.stop(); }} />
      ) : null}
    </div>
  );
}
