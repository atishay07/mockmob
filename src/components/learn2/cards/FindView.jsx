'use client';
// Find, the subject scope (DESIGN-SPEC A5, B 3.7): used by Learn home's Find tab.
//   Search   chapters, lessons and cards; 2 or more characters; matches underlined; results as the same card list, answers folded
//            (a card whose match is only in NCERT's words shows that line). One header: "27 cards in 1 chapter".
//   Shelves  Due today, Missed lately, In Revise, Must-know: four paper piles with the real count on the top sheet, one tap each,
//            and under them "By chapter": where the due cards and the open mistakes are, one tap to the chapter
//              Due today     Revise these (the Key cards Revise run)
//              Missed lately Study these (a cards run over the missed set)
//              In Revise, Must-know   Browse: the set across the subject's chapters, in the same list
// Data: GET /api/learn/shelves, /api/learn/search, /api/learn/subject, and each chapter's /api/learn/cards for a shelf's set (learn2/api.js).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { ErrorState } from '@/components/ui/Skeleton';
import { ncertFont } from '@/components/keycards/ncertFont';
import { PRO_LINE } from '@/components/keycards/kinds';
import { useAuth } from '@/components/AuthProvider';
import { chapterCards, learnSearch, learnShelves, learnSubject, useLearnRead } from '../api';
import { useLearnLinks } from '../links';
import CardList from './CardList';
import { PickBar, Skeleton } from './CardsView';
import { RUN_CARDS_MAX, countWord, subjectLabel, useAddToRevise, usePick, withParams } from './cardsShared';
import '@/components/keycards/keycards.css';
import './cards.css';

const MIN_CHARS = 2;

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/**
 * One shelf's cards across the subject: each chapter's own cards read with the shelf's filter, one section per chapter, in book
 * order. Six reads at a time; a chapter that does not load is left out, never faked.
 */
async function loadShelfSet({ subject, shelf }) {
  const home = await learnSubject(subject);
  const filter = shelf === 'must' ? 'must' : shelf === 'revise' ? 'revise' : 'missed';
  const chapters = (home.parts || []).flatMap((p) => (p.units || []).flatMap((u) => u.chapters || [])).filter((c) => c.cards > 0 && (shelf !== 'must' || c.mustKnow > 0));
  const reads = [];
  for (let i = 0; i < chapters.length; i += 6) {
    const part = chapters.slice(i, i + 6);
    reads.push(...await Promise.all(part.map((c) => chapterCards({ chapter: c.key, filter }).catch(() => null))));
  }
  const sections = [];
  let lockedCount = 0;
  chapters.forEach((c, i) => {
    const body = reads[i];
    if (!body) return;
    lockedCount += body.lockedCount || 0;
    const cards = (body.sections || []).flatMap((s) => s.cards || []);
    if (cards.length) sections.push({ key: c.key, title: c.title, cards });
  });
  return { sections, lockedCount, plan: reads.find(Boolean)?.plan || 'free' };
}

const SHELVES = [
  { id: 'due', title: 'Due today' },
  { id: 'missed', title: 'Missed lately' },
  { id: 'revise', title: 'In Revise' },
  { id: 'must', title: 'Must-know' },
];

function shelfView(id, s) {
  if (!s) return { count: 0, sub: '' };
  if (id === 'due') return { count: s.count, sub: s.count ? `about ${s.minutes} min` : 'nothing due' };
  if (id === 'missed') return { count: s.count, sub: 'last 14 days' };
  if (id === 'revise') return { count: s.count, sub: s.chapters ? `across ${countWord(s.chapters, 'chapter')}` : 'none yet' };
  return { count: s.count, sub: s.chapters ? `in ${countWord(s.chapters, 'chapter')}` : '' };
}

/** One shelf as a pile of paper: three sheets fanned, the count on the top one. The whole pile is the control. */
function Pile({ id, title, count, sub, verb, i, href, onClick, disabled }) {
  const zero = !count;
  const body = (
    <>
      <span className="l2f-pile__stack" aria-hidden="true">
        <span className="l2f-sheet l2f-sheet--c" />
        <span className="l2f-sheet l2f-sheet--b" />
        <span className="l2f-sheet l2f-sheet--a" data-kind={id}>
          <span className="l2f-pile__n">{count}</span>
          <span className="l2f-lines"><i /><i /></span>
        </span>
      </span>
      <span className="l2f-pile__t">{title}</span>
      <span className="l2f-pile__sub">{sub}</span>
      <span className="l2f-pile__verb">{zero ? 'None yet' : verb}</span>
    </>
  );
  const props = {
    className: 'l2f-pile l2f-shelf',
    'data-zero': zero || undefined,
    style: { '--i': i },
    'aria-label': `${title}, ${countWord(count, 'card')}${zero ? '' : `, ${verb.toLowerCase()}`}`,
  };
  if (zero) return <div {...props} role="group">{body}</div>;
  if (href) return <Link {...props} href={href}>{body}</Link>;
  return <button type="button" {...props} disabled={disabled} onClick={onClick}>{body}</button>;
}

function Shelves({ shelves, onBrowse, onStudyMissed, busy, links }) {
  return (
    <section className="l2f-shelves" aria-label="Your cards">
      <h2 className="l2f-h">Your cards</h2>
      <div className="l2f-piles">
        {SHELVES.map((sh, i) => {
          const v = shelfView(sh.id, shelves?.[sh.id]);
          const base = { id: sh.id, title: sh.title, count: v.count, sub: v.sub, i };
          if (sh.id === 'due') return <Pile key={sh.id} {...base} verb="Revise these" href={links.revise()} />;
          if (sh.id === 'missed') return <Pile key={sh.id} {...base} verb={busy === 'missed' ? 'Opening' : 'Study these'} disabled={busy === 'missed'} onClick={onStudyMissed} />;
          return <Pile key={sh.id} {...base} verb="Browse" onClick={() => onBrowse(sh.id)} />;
        })}
      </div>
    </section>
  );
}

/** "By chapter": the chapters with something waiting (due cards or open mistakes), most due first, one tap to the chapter. */
function ByChapter({ home, links }) {
  const rows = (home?.parts || []).flatMap((p) => (p.units || []).flatMap((u) => u.chapters || []))
    .filter((c) => (c.due || 0) > 0 || (c.mistakes || 0) > 0)
    .sort((a, b) => (b.due || 0) - (a.due || 0) || (b.mistakes || 0) - (a.mistakes || 0))
    .slice(0, 6);
  if (!rows.length) return null;
  return (
    <section className="l2f-bychapter" aria-labelledby="l2f-by">
      <h2 className="l2f-h" id="l2f-by">By chapter</h2>
      <ul className="l2f-links">
        {rows.map((c) => {
          const bits = [c.due ? `${c.due} due` : null, c.mistakes ? `${c.mistakes} open ${c.mistakes === 1 ? 'mistake' : 'mistakes'}` : null].filter(Boolean).join(', ');
          return <li key={c.key}><Link className="l2f-link" href={links.chapter(c.key)}><b>{c.title}</b><span>{bits}</span><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></Link></li>;
        })}
      </ul>
    </section>
  );
}

/** Search results' cards, grouped by chapter in the order they came, as the card list's sections. */
function resultSections(cards = []) {
  const map = new Map();
  for (const r of cards) {
    if (!r?.card || r.locked || r.card.locked) continue;
    if (!map.has(r.chapterKey)) map.set(r.chapterKey, { key: r.chapterKey, title: r.chapterTitle, cards: [] });
    map.get(r.chapterKey).cards.push({ ...r.card, chapterKey: r.chapterKey });
  }
  return [...map.values()];
}

export default function FindView({ subject }) {
  const links = useLearnLinks();
  const router = useRouter();
  const { user } = useAuth() || {};
  const isPro = user?.isPremium === true;
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 240);
  const searching = query.length >= MIN_CHARS;
  const input = useRef(null);
  const pick = usePick();
  const actions = useAddToRevise({ isPro });
  const [browse, setBrowse] = useState(null);
  const [busy, setBusy] = useState(null);

  const shelves = useLearnRead(() => learnShelves(subject), [subject]);
  const home = useLearnRead(() => learnSubject(subject), [subject]);
  const results = useLearnRead(() => (searching ? learnSearch({ subject, query }) : Promise.resolve(null)), [subject, searching ? query : '']);
  const browsed = useLearnRead(() => (browse ? loadShelfSet({ subject, shelf: browse }) : Promise.resolve(null)), [subject, browse]);

  const sections = useMemo(() => resultSections(results.data?.cards), [results.data]);
  const lockedMatches = (results.data?.cards || []).filter((r) => r.locked || r.card?.locked).length;
  const browseSections = browsed.data?.sections || [];
  const active = browse && !searching ? browseSections : sections;
  const cardById = useMemo(() => { const m = new Map(); for (const s of active) for (const c of s.cards) m.set(c.id, c); return m; }, [active]);
  const idsNow = useMemo(() => [...cardById.keys()], [cardById]);
  const pickedIds = [...pick.picked].filter((id) => cardById.has(id));
  const firstChapter = (ids) => cardById.get(ids[0])?.chapterKey || '';

  const stopBrowse = useCallback(() => { setBrowse(null); pick.stop(); }, [pick]);
  const runHref = useCallback((ids) => withParams(links.run({ chapterKey: firstChapter(ids), minutes: 10, kind: 'cards' }), { cards: ids.slice(0, RUN_CARDS_MAX).join(',') }), [links, cardById]); // eslint-disable-line react-hooks/exhaustive-deps
  const studyOne = useCallback((card) => runHref([card.id]), [runHref]);
  const chapterHref = useCallback((card) => withParams(links.cards(card.chapterKey), { open: card.id }), [links]);
  const groupHref = useCallback((g) => links.chapter(g.key), [links]);

  const studyMissed = useCallback(async () => {
    setBusy('missed');
    try {
      const set = await loadShelfSet({ subject, shelf: 'missed' });
      const cards = set.sections.flatMap((s) => s.cards);
      if (!cards.length) { setBusy(null); return; }
      router.push(withParams(links.run({ chapterKey: cards[0].chapterKey, minutes: 10, kind: 'cards' }), { cards: cards.map((c) => c.id).join(',') }));
    } catch { setBusy(null); }
  }, [subject, links, router]);

  const label = subjectLabel(subject);
  const box = (
    <div className="l2f-search" role="search">
      <Search size={20} strokeWidth={2} aria-hidden="true" />
      <input ref={input} type="search" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search a term, line or chapter" aria-label={`Search ${label || 'your subject'}`} />
      {text ? <button type="button" className="l2f-clear" aria-label="Clear the search" onClick={() => { setText(''); input.current?.focus(); }}><X size={18} strokeWidth={2.2} aria-hidden="true" /></button> : null}
    </div>
  );

  const list = (secs, props = {}) => (
    <CardList
      sections={secs}
      isPro={isPro}
      pickMode={pick.mode}
      picked={pick.picked}
      onPick={pick.toggle}
      addedIds={actions.added}
      onAdd={(ids, opener) => actions.add(ids, opener)}
      adding={actions.busy}
      studyHref={studyOne}
      {...props}
    />
  );

  let body;
  if (searching) {
    if (results.status === 'loading') body = <Skeleton />;
    else if (results.status === 'error' || !results.data) body = <ErrorState title="Search did not load" message="Check your connection and try again." onRetry={results.refresh} />;
    else {
      const r = results.data;
      const nCards = sections.reduce((n, s) => n + s.cards.length, 0);
      // A chapter that is already the header of a group below is not listed twice.
      const inGroups = new Set(sections.map((s) => s.key));
      const chapterRows = (r.chapters || []).filter((c) => !inGroups.has(c.key));
      const nCh = chapterRows.length;
      const nLe = r.lessons?.length || 0;
      const head = nCards
        ? [`${countWord(nCards, 'card')} in ${countWord(sections.length, 'chapter')}`, nLe ? countWord(nLe, 'lesson') : null].filter(Boolean).join(', ')
        : [nCh ? countWord(nCh, 'chapter') : null, nLe ? countWord(nLe, 'lesson') : null].filter(Boolean).join(', ');
      if (!nCards && !nCh && !nLe && !lockedMatches) {
        body = <div className="l2c-empty"><h2>Nothing matches that.</h2><p>Try a term from the book or a chapter name.</p></div>;
      } else {
        body = (
          <div className={`l2f-results${results.status === 'refreshing' ? ' l2c-refreshing' : ''}`}>
            <div className="l2f-sub">
              <h2 className="l2f-h">Results for “{query}”</h2>
              <p>{head}</p>
            </div>
            {nCh ? (
              <ul className="l2f-links" aria-label="Chapters">
                {chapterRows.map((c) => <li key={c.key}><Link className="l2f-link" href={links.chapter(c.key)}><b>{c.title}</b><span>chapter, {countWord(c.cards, 'card')}</span><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></Link></li>)}
              </ul>
            ) : null}
            {nLe ? (
              <ul className="l2f-links" aria-label="Lessons">
                {r.lessons.map((l) => <li key={l.id}><Link className="l2f-link" href={links.lesson(l.id)}><b>{l.title}</b><span>lesson</span><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></Link></li>)}
              </ul>
            ) : null}
            {nCards || lockedMatches ? list(sections, {
              showAnswers: false,
              query,
              chapterHref,
              groupHref,
              idPrefix: 'l2f-sec',
              lockedLine: lockedMatches ? `${lockedMatches} more ${lockedMatches === 1 ? 'card matches' : 'cards match'} in cards Pro opens. ${PRO_LINE}` : null,
            }) : null}
            {r.more ? <p className="kc-fine">{countWord(r.more, 'more card')} match. Add a word to narrow it.</p> : null}
          </div>
        );
      }
    }
  } else if (browse) {
    const title = SHELVES.find((s) => s.id === browse)?.title;
    if (browsed.status === 'loading') body = <Skeleton />;
    else if (browsed.status === 'error' || !browsed.data) body = <ErrorState title="The cards did not load" message="Check your connection and try again." onRetry={browsed.refresh} />;
    else {
      const total = browseSections.reduce((n, s) => n + s.cards.length, 0);
      const lockedCount = browsed.data.lockedCount || 0;
      const showPickBar = pick.mode && pickedIds.length > 0;
      body = (
        <div className="l2f-browse">
          <button type="button" className="kc-back l2f-back" onClick={stopBrowse}><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />Your cards</button>
          <div className="l2f-sub"><h2 className="l2f-h">{title}</h2><p>{countWord(total, 'card')}</p></div>
          <div className="l2c-tools">
            <button type="button" className="kc-btn kc-btn--quiet" aria-pressed={pick.mode} aria-label={pick.mode ? 'Done picking' : 'Pick cards'} onClick={() => (pick.mode ? pick.stop() : pick.setMode(true))}>{pick.mode ? 'Done' : 'Pick'}</button>
          </div>
          {total && total <= RUN_CARDS_MAX ? (
            <div className="l2c-keys">
              <Link className={showPickBar ? 'kc-btn kc-btn--line kc-btn--small' : 'kc-btn kc-btn--volt kc-btn--small'} href={runHref(idsNow)}>Study these {total}</Link>
            </div>
          ) : null}
          {total > RUN_CARDS_MAX ? <p className="kc-fine">That is a lot for one run. Pick up to {RUN_CARDS_MAX} cards to study them, or open a chapter.</p> : null}
          {total ? list(browseSections, {
            showAnswers: false,
            chapterHref,
            groupHref,
            idPrefix: 'l2f-browse',
            lockedLine: lockedCount ? `${countWord(lockedCount, 'more card')} in these chapters. ${PRO_LINE}` : null,
          }) : <div className="l2c-empty"><h2>Nothing here yet.</h2><p>{browse === 'revise' ? 'Rate a card in a run and it joins Revise.' : 'No cards in this set.'}</p></div>}
        </div>
      );
    }
  } else if (shelves.status === 'loading') {
    body = (
      <section className="l2f-shelves" role="status" aria-label="Loading your cards">
        <h2 className="l2f-h">Your cards</h2>
        <div className="l2f-piles">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="l2f-pile l2f-shelf">
              <span className="skeleton l2f-pile__stack" />
              <span className="skeleton" style={{ width: 90, height: 18 }} />
              <span className="skeleton" style={{ width: 70, height: 16 }} />
              <span className="skeleton" style={{ width: 80, height: 18, marginTop: 8 }} />
            </div>
          ))}
        </div>
      </section>
    );
  } else if (shelves.status === 'error' || !shelves.data) {
    body = <ErrorState title="Your cards did not load" message="Check your connection and try again." onRetry={shelves.refresh} />;
  } else {
    body = (
      <>
        <Shelves shelves={shelves.data} onBrowse={setBrowse} onStudyMissed={studyMissed} busy={busy} links={links} />
        <ByChapter home={home.data} links={links} />
      </>
    );
  }

  const showPickBar = pick.mode && pickedIds.length > 0;
  return (
    <div className={`kc kc--inline l2c l2f ${ncertFont.variable}`} data-pick={pick.mode || undefined}>
      {box}
      {actions.said ? <p className="l2c-said" role="status">{actions.said}</p> : null}
      {actions.error ? <p className="kc-err" role="alert">{actions.error}</p> : null}
      {body}
      {showPickBar ? (
        <PickBar count={pickedIds.length} studyHref={runHref(pickedIds)} adding={actions.busy} onClear={pick.clear} onAdd={async (opener) => { const ok = await actions.add(pickedIds, opener); if (ok) pick.stop(); }} />
      ) : null}
    </div>
  );
}
