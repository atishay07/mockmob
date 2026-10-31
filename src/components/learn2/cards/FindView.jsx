'use client';
// Find, the subject scope (A3 3.3): what Learn home's panel shows in place of the chapters while the student searches or opens one
// of the three shelf keys. Learn home owns the field and the keys; this draws what they ask for, with the Key cards view's own
// layout (a chapter rail and the list) from a 980 px container, so finding and revising specific cards is one idea everywhere.
//   Results  "Results for “goodwill”" and "50 cards in 4 chapters"; chapter and lesson matches (3 each); the cards grouped by
//            chapter, answers folded, the match underlined; "Quick recap these 50" and "Study these 50" (the panel's one volt key)
//   A set    Due today, Missed lately, In Revise, Must-know: the whole subject's cards in one request, grouped by chapter, one
//            key that plays exactly the cards it names ("Revise these 9": a cards run of the due ids)
// Data: GET /api/learn/search, GET /api/learn/cards?subject=&filter= (one request: A3-16), GET /api/learn/subject (learn2/api.js).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorState } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { ncertFont } from '@/components/keycards/ncertFont';
import { PRO_LINE } from '@/components/keycards/kinds';
import { useAuth } from '@/components/AuthProvider';
import { learnSearch, learnSubject, subjectCards, useLearnRead } from '../api';
import { useLearnLinks } from '../links';
import CardList from './CardList';
import { FilterChips, Jump, PickBar, Rail, goToSection, useCurrentSection } from './CardsView';
import { RUN_CARDS_MAX, countWord, useAddToRevise, usePick, withParams } from './cardsShared';
import { setHead } from '../home/homeModel.mjs';
import '@/components/keycards/keycards.css';
import './cards.css';

const MIN_CHARS = 2;
const SHOWN = 3;

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
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

/** A shelf's cards from the one-request subject read, one section per chapter in book order. */
function setSections(body) {
  return (body?.chapters || [])
    .map((c) => ({ key: c.key, title: c.title, cards: (c.cards || []).filter((card) => !card.locked).map((card) => ({ ...card, chapterKey: c.key })) }))
    .filter((s) => s.cards.length);
}

/** The panel before its data: the head line and six rows at the size they will have, so nothing moves when it lands. */
function PanelSkeleton({ rows = 6, label = 'Loading the cards' }) {
  return (
    <div className="l2f-skel" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="l2c-skel__row"><span className="skeleton" /><span className="skeleton" /></div>)}
    </div>
  );
}

/** Rows that go to a chapter or a lesson: up to three, then one text key for the rest. */
function LinkRows({ label, rows, all, onAll, noun }) {
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, SHOWN);
  return (
    <div className="l2f-block">
      <ul className="l2f-links" aria-label={label}>
        {shown.map((r) => (
          <li key={r.key}><Link className="l2f-link" href={r.href}><b>{r.title}</b><span>{r.meta}</span><ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" /></Link></li>
        ))}
      </ul>
      {!all && rows.length > SHOWN ? <button type="button" className="l2f-more" onClick={onAll}>{`Show all ${rows.length} ${noun}`}</button> : null}
    </div>
  );
}

/** The tools and keys the results and the sets share: Show answers, the chapter jump on a phone, Pick, and the study keys. */
function Tools({ showAnswers, onShowAnswers, pick, groups }) {
  return (
    <div className="l2c-tools">
      <label className="l2c-switch">
        <Switch checked={showAnswers} onChange={onShowAnswers} aria-label="Show answers" />
        <span aria-hidden="true">Show answers</span>
      </label>
      <Jump sections={groups} onGo={goToSection} label="Chapters" />
      <button type="button" className="kc-btn kc-btn--quiet" aria-pressed={pick.mode} aria-label={pick.mode ? 'Done picking' : 'Pick cards'} onClick={() => (pick.mode ? pick.stop() : pick.setMode(true))}>{pick.mode ? 'Done' : 'Pick'}</button>
    </div>
  );
}

/** The panel's shared card list, pick and Add to Revise wiring. */
function useCardPanel({ isPro, cardIds }) {
  const pick = usePick();
  const actions = useAddToRevise({ isPro });
  const [showAnswers, setShowAnswers] = useState(false);
  const [groups, setGroups] = useState([]);
  const current = useCurrentSection(groups);
  const pickedIds = [...pick.picked].filter((id) => cardIds.includes(id));
  return { pick, actions, showAnswers, setShowAnswers, groups, setGroups, current, pickedIds, showPickBar: pick.mode && pickedIds.length > 0 };
}

function Notices({ actions }) {
  return (
    <>
      {actions.said ? <p className="l2c-said" role="status">{actions.said}</p> : null}
      {actions.error ? <p className="kc-err" role="alert">{actions.error}</p> : null}
    </>
  );
}

/** One run href over a set of cards (Study these, Revise these, Quick recap these). The chapter is the first card's. */
function useRunHref(links, chapterOf) {
  return useCallback((ids, kind = 'cards', minutes = 10) => links.run({ chapterKey: chapterOf(ids[0]), minutes, kind, cardIds: ids.slice(0, RUN_CARDS_MAX) }), [links, chapterOf]);
}

// ------------------------------------------------------------------------------------------------------------ results

function Results({ subject, text }) {
  const links = useLearnLinks();
  const { user } = useAuth() || {};
  const isPro = user?.isPremium === true;
  const query = useDebounced(text.trim(), 240);
  const searching = query.length >= MIN_CHARS;
  const results = useLearnRead(() => (searching ? learnSearch({ subject, query }) : Promise.resolve(null)), [subject, searching ? query : '']);
  const [allCh, setAllCh] = useState(false);
  const [allLe, setAllLe] = useState(false);
  useEffect(() => { setAllCh(false); setAllLe(false); }, [query]); // eslint-disable-line react-hooks/set-state-in-effect -- a new query starts from three rows again

  const sections = useMemo(() => resultSections(results.data?.cards), [results.data]);
  const cardById = useMemo(() => { const m = new Map(); for (const s of sections) for (const c of s.cards) m.set(c.id, c); return m; }, [sections]);
  const ids = useMemo(() => [...cardById.keys()], [cardById]);
  const panel = useCardPanel({ isPro, cardIds: ids });
  const { pick, actions } = panel;
  const chapterOf = useCallback((id) => cardById.get(id)?.chapterKey || '', [cardById]);
  const runHref = useRunHref(links, chapterOf);
  const studyOne = useCallback((card) => runHref([card.id]), [runHref]);
  const chapterHref = useCallback((card) => withParams(links.cards(card.chapterKey), { open: card.id }), [links]);
  const groupHref = useCallback((g) => links.chapter(g.key), [links]);

  if (text.trim().length < MIN_CHARS) {
    return <div className="l2f-panel"><div className="l2f-hint"><p>Type at least 2 letters to search.</p></div></div>;
  }

  const r = results.data;
  const nCards = ids.length;
  const lockedMatches = (r?.cards || []).filter((x) => x.locked || x.card?.locked).length;
  const inGroups = new Set(sections.map((s) => s.key));
  const chapterRows = (r?.chapters || []).filter((c) => !inGroups.has(c.key)).map((c) => ({ key: c.key, title: c.title, href: links.chapter(c.key), meta: `chapter, ${countWord(c.cards, 'card')}` }));
  const lessonRows = (r?.lessons || []).map((l) => ({ key: l.id, title: l.title, href: links.lesson(l.id), meta: 'lesson' }));
  const countLine = !r ? '' : nCards
    ? [`${countWord(nCards, 'card')} in ${countWord(sections.length, 'chapter')}`, lessonRows.length ? countWord(lessonRows.length, 'lesson') : null].filter(Boolean).join(', ')
    : [chapterRows.length ? countWord(chapterRows.length, 'chapter') : null, lessonRows.length ? countWord(lessonRows.length, 'lesson') : null].filter(Boolean).join(', ');

  let body;
  if (!searching || results.status === 'loading') {
    body = <PanelSkeleton />;
  } else if (results.status === 'error' || !r) {
    body = <ErrorState title="Search did not load" message="Check your connection and try again." onRetry={results.refresh} />;
  } else if (!nCards && !chapterRows.length && !lessonRows.length && !lockedMatches) {
    body = <div className="l2c-empty"><h2>Nothing matches “{query}”.</h2><p>Check the spelling, or try a term from the book.</p></div>;
  } else {
    body = (
      <>
        {nCards ? (
          <>
            <Tools showAnswers={panel.showAnswers} onShowAnswers={panel.setShowAnswers} pick={pick} groups={panel.groups} />
            {nCards <= RUN_CARDS_MAX ? (
              <div className="l2c-keys">
                <Link className="kc-btn kc-btn--line kc-btn--small" href={runHref(ids, 'recap', 3)}>Quick recap these {nCards}</Link>
                <Link className={panel.showPickBar ? 'kc-btn kc-btn--line kc-btn--small' : 'kc-btn kc-btn--volt kc-btn--small'} data-page-primary={panel.showPickBar ? undefined : ''} href={runHref(ids)}>Study these {nCards}</Link>
              </div>
            ) : <p className="kc-fine l2f-over">{nCards} cards match. Pick up to {RUN_CARDS_MAX} to study them, or add a word.</p>}
          </>
        ) : null}
        <Notices actions={actions} />
        <LinkRows label="Chapters" rows={chapterRows} all={allCh} onAll={() => setAllCh(true)} noun="chapters" />
        <LinkRows label="Lessons" rows={lessonRows} all={allLe} onAll={() => setAllLe(true)} noun="lessons" />
        {nCards || lockedMatches ? (
          <div className={results.status === 'refreshing' ? 'l2c-refreshing' : undefined}>
            <CardList
              sections={sections}
              isPro={isPro}
              showAnswers={panel.showAnswers}
              pickMode={pick.mode}
              picked={pick.picked}
              onPick={pick.toggle}
              addedIds={actions.added}
              onAdd={(cardIds, opener) => actions.add(cardIds, opener)}
              adding={actions.busy}
              studyHref={studyOne}
              query={query}
              chapterHref={chapterHref}
              groupHref={groupHref}
              idPrefix="l2f-sec"
              onSections={panel.setGroups}
              lockedLine={lockedMatches ? `${lockedMatches} more ${lockedMatches === 1 ? 'card matches' : 'cards match'} in cards Pro opens. ${PRO_LINE}` : null}
            />
          </div>
        ) : null}
        {r.more ? <p className="kc-fine">{countWord(r.more, 'more card')} match. Add a word to narrow it.</p> : null}
      </>
    );
  }

  return (
    <div className="l2f-panel" data-kind="results" data-pick={pick.mode || undefined}>
      <div className="l2f-layout">
        <Rail sections={panel.groups} current={panel.current} onGo={goToSection} heading={panel.groups.length ? `In ${countWord(panel.groups.length, 'chapter')}` : ''} />
        <div className="l2f-main">
          <div className="l2f-sub">
            <h2 className="l2f-h">Results for “{query || text.trim()}”</h2>
            <p className="l2f-count" role="status">{countLine}</p>
          </div>
          {body}
        </div>
      </div>
      {panel.showPickBar ? (
        <PickBar count={panel.pickedIds.length} studyHref={runHref(panel.pickedIds)} adding={actions.busy} onClear={pick.clear} onAdd={async (opener) => { const ok = await actions.add(panel.pickedIds, opener); if (ok) pick.stop(); }} />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------ a set

const EMPTY_SET = {
  due: ['Nothing here now.', 'Cards you rate in a run come back here on the day they are due.'],
  missed: ['Nothing here now.', 'A card you miss in a run shows here until you get it right.'],
  revise: ['Nothing here now.', 'Rate a card in a run and it joins Revise.'],
  must: ['Nothing here now.', 'No Must-know cards are open in this subject yet.'],
};

/**
 * The due set before the service filters by `due` (filter=due, S3): the chapters with cards due and one key to the Key cards queue.
 * The service echoes the filter it applied; an answer that is not `due` means the cards it sent are not the due ones.
 */
function DueFallback({ home, shelves, links }) {
  const rows = (home?.parts || []).flatMap((p) => (p.units || []).flatMap((u) => u.chapters || [])).filter((c) => (c.due || 0) > 0).sort((a, b) => (b.due || 0) - (a.due || 0));
  const all = Number(shelves?.due?.all) || Number(shelves?.due?.count) || 0;
  return (
    <>
      {all ? <div className="l2c-keys"><Link className="kc-btn kc-btn--volt kc-btn--small" data-page-primary="" href={links.revise()}>{`Revise ${all} due, all subjects`}</Link></div> : null}
      <ul className="l2f-links" aria-label="Chapters with cards due">
        {rows.map((c) => <li key={c.key}><Link className="l2f-link" href={links.chapter(c.key)}><b>{c.title}</b><span>{c.due} due</span><ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" /></Link></li>)}
      </ul>
    </>
  );
}

function SetPanel({ subject, shelf, shelves, onShelf, onBack }) {
  const links = useLearnLinks();
  const { user } = useAuth() || {};
  const isPro = user?.isPremium === true;
  const read = useLearnRead(() => subjectCards({ subject, filter: shelf }), [subject, shelf]);
  const dueFallback = shelf === 'due' && read.status === 'ready' && read.data && read.data.filter !== 'due';
  const home = useLearnRead(() => (dueFallback ? learnSubject(subject) : Promise.resolve(null)), [subject, dueFallback]);
  const sections = useMemo(() => (dueFallback ? [] : setSections(read.data)), [read.data, dueFallback]);
  const cardById = useMemo(() => { const m = new Map(); for (const s of sections) for (const c of s.cards) m.set(c.id, c); return m; }, [sections]);
  const ids = useMemo(() => [...cardById.keys()], [cardById]);
  const panel = useCardPanel({ isPro, cardIds: ids });
  const { pick, actions } = panel;
  const chapterOf = useCallback((id) => cardById.get(id)?.chapterKey || '', [cardById]);
  const runHref = useRunHref(links, chapterOf);
  const studyOne = useCallback((card) => runHref([card.id]), [runHref]);
  const chapterHref = useCallback((card) => withParams(links.cards(card.chapterKey), { open: card.id }), [links]);
  const groupHref = useCallback((g) => links.chapter(g.key), [links]);

  const total = ids.length;
  const head = setHead(shelf, { count: dueFallback ? Number(shelves?.due?.count) || 0 : total, chapters: dueFallback ? 0 : sections.length, shelves });
  const options = [
    { value: 'due', label: 'Due today', count: Number(shelves?.due?.count) || 0 },
    { value: 'missed', label: 'Missed lately', count: Number(shelves?.missed?.count) || 0 },
    { value: 'revise', label: 'In Revise', count: Number(shelves?.revise?.count) || 0 },
    { value: 'must', label: 'Must-know', count: Number(shelves?.must?.count) || 0 },
  ];
  const lockedCount = read.data?.lockedCount || 0;
  const [emptyTitle, emptyText] = EMPTY_SET[shelf] || EMPTY_SET.revise;

  let body;
  if (read.status === 'loading') {
    body = <PanelSkeleton label="Loading the cards" />;
  } else if (read.status === 'error' || !read.data) {
    body = <ErrorState title="The cards did not load" message="Check your connection and try again." onRetry={read.refresh} />;
  } else if (dueFallback) {
    body = <DueFallback home={home.data} shelves={shelves} links={links} />;
  } else if (!total) {
    body = <div className="l2c-empty"><h2>{emptyTitle}</h2><p>{emptyText}</p></div>;
  } else {
    const due = shelf === 'due';
    body = (
      <>
        <Tools showAnswers={panel.showAnswers} onShowAnswers={panel.setShowAnswers} pick={pick} groups={panel.groups} />
        {total <= RUN_CARDS_MAX ? (
          <div className="l2c-keys">
            {!due ? <Link className="kc-btn kc-btn--line kc-btn--small" href={runHref(ids, 'recap', 3)}>Quick recap these {total}</Link> : null}
            <Link className={panel.showPickBar ? 'kc-btn kc-btn--line kc-btn--small' : 'kc-btn kc-btn--volt kc-btn--small'} data-page-primary={panel.showPickBar ? undefined : ''} href={runHref(ids)}>{due ? `Revise these ${total}` : `Study these ${total}`}</Link>
          </div>
        ) : <p className="kc-fine l2f-over">{total} cards in this set. Pick up to {RUN_CARDS_MAX} to study them, or open a chapter.</p>}
        <Notices actions={actions} />
        <div className={read.status === 'refreshing' ? 'l2c-refreshing' : undefined}>
          <CardList
            sections={sections}
            isPro={isPro}
            showAnswers={panel.showAnswers}
            pickMode={pick.mode}
            picked={pick.picked}
            onPick={pick.toggle}
            addedIds={actions.added}
            onAdd={(cardIds, opener) => actions.add(cardIds, opener)}
            adding={actions.busy}
            studyHref={studyOne}
            chapterHref={chapterHref}
            groupHref={groupHref}
            idPrefix="l2f-set"
            hideTags={shelf === 'due' || shelf === 'missed' ? [shelf, 'revise'] : [shelf]}
            compact
            onSections={panel.setGroups}
            lockedLine={shelf === 'must' && !isPro && lockedCount ? `More Must-know cards open with Pro. ${PRO_LINE}` : null}
          />
        </div>
      </>
    );
  }

  return (
    <div className="l2f-panel" data-kind="set" data-pick={pick.mode || undefined}>
      <div className="l2f-layout">
        <Rail sections={panel.groups} current={panel.current} onGo={goToSection} heading={panel.groups.length ? `In ${countWord(panel.groups.length, 'chapter')}` : ''} />
        <div className="l2f-main">
          <div className="l2f-sethead">
            <button type="button" className="l2f-back" onClick={onBack}><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />Chapters</button>
            <div className="l2f-sub">
              <h2 className="l2f-h l2f-h--set">{head.title}</h2>
              <p className="l2f-count" role="status">{read.status === 'loading' ? '' : head.line}</p>
            </div>
          </div>
          <FilterChips value={shelf} onChange={onShelf} options={options} label="Which set" />
          {body}
        </div>
      </div>
      {panel.showPickBar ? (
        <PickBar count={panel.pickedIds.length} studyHref={runHref(panel.pickedIds)} adding={actions.busy} onClear={pick.clear} onAdd={async (opener) => { const ok = await actions.add(panel.pickedIds, opener); if (ok) pick.stop(); }} />
      ) : null}
    </div>
  );
}

/** What Learn home's panel shows while the student searches (`text`) or has a shelf key open (`shelf`). */
export default function FindView({ subject, text = '', shelf = null, shelves = null, onShelf, onBack }) {
  const searching = text.trim().length > 0;
  return (
    <div className={`kc kc--inline l2c l2f ${ncertFont.variable}`}>
      {searching
        ? <Results subject={subject} text={text} />
        : shelf ? <SetPanel subject={subject} shelf={shelf} shelves={shelves} onShelf={onShelf} onBack={onBack} /> : null}
    </div>
  );
}
