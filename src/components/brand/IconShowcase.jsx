'use client';

// The branded icon set on one page, for the owner's look (R7 packet I, LK60). Development preview only:
// /preview/arena?view=icons. Shows each desk object beside the line icon it replaces, the sizes it holds at, the rows it
// now leads on the web, a dock proposal (not swapped yet) and Mobi's small mark. Links keep the preview's settings, so
// each one lands on the real screen with Learn v2 on.
import * as React from 'react';
import { BookOpen, Bookmark, CalendarCheck, ChevronRight, Compass, GalleryVerticalEnd, Layers, MessageCircle, NotebookText, Play, Printer, RotateCcw, Timer, UserRound, Users, Wrench } from 'lucide-react';
import { BrandIcon, MobiMark } from './BrandIcon';
import './icon-showcase.css';

const SET = [
  { name: 'keycards', label: 'Key cards', was: null, wasName: 'words only', where: 'Chapter shelf' },
  { name: 'questions', label: 'Questions', was: Layers, wasName: 'layers in the app', where: 'Chapter shelf, Learn home' },
  { name: 'mistakes', label: 'Your mistakes', was: Wrench, wasName: 'a wrench', where: 'Practice, chapter shelf, Learn home' },
  { name: 'lesson', label: 'Lesson', was: BookOpen, wasName: 'an open-book outline', where: 'Chapter shelf' },
  { name: 'print', label: 'Print sheet', was: Printer, wasName: 'a printer', where: 'Chapter shelf' },
  { name: 'revise', label: 'Revise', was: RotateCcw, wasName: 'a turning arrow', where: 'Learn home, app Review again' },
  { name: 'feeds', label: 'Chapter feeds', was: GalleryVerticalEnd, wasName: 'a gallery outline in the app', where: 'Learn home, app Chapter feeds' },
  { name: 'saved', label: 'Saved', was: Bookmark, wasName: 'a bookmark outline', where: 'Next: the Saved page' },
  { name: 'papers', label: 'Your papers', was: NotebookText, wasName: 'a notebook in a tile', where: 'Practice' },
  { name: 'compass', label: 'Admission Compass', was: Compass, wasName: 'a compass outline', where: 'Next: Colleges, app More ways in' },
  { name: 'today', label: 'Today', was: CalendarCheck, wasName: 'a calendar outline', where: 'Dock, proposed' },
  { name: 'mob', label: 'Mob', was: Users, wasName: 'a people outline', where: 'Dock, proposed' },
  { name: 'you', label: 'You', was: UserRound, wasName: 'a person outline', where: 'Dock, proposed' },
];

const SHELF = [
  { name: 'keycards', title: 'Key cards', line: 'All 60, by section' },
  { name: 'questions', title: 'Questions only', line: '10 questions in this chapter' },
  { name: 'mistakes', title: 'Your mistakes', line: 'Fix 2 open mistakes · 2 min' },
  { name: 'lesson', title: 'Revaluation of assets and liabilities', line: 'Lesson · 7 min, not read yet' },
  { name: 'print', title: 'Print sheet', line: '15 Must-know lines, with your name' },
];

const noop = () => () => {};

function useLinks() {
  // The page's own settings, read once on the client (the server draws the defaults).
  const base = React.useSyncExternalStore(noop, () => window.location.search, () => '');
  return React.useCallback((patch) => {
    const q = new URLSearchParams(base);
    for (const k of ['decks', 'study', 'plan', 'student']) if (!q.get(k)) q.set(k, { decks: 'real', study: 'on', plan: 'pro', student: 'commerce' }[k]);
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    return `/preview/arena?${q.toString()}`;
  }, [base]);
}

export default function IconShowcase() {
  const href = useLinks();
  return (
    <div className="student-page ics">
      <header className="ics-head">
        <p className="ics-kicker">Design preview · branded icons</p>
        <h1>One desk, one object per meaning</h1>
        <p className="ics-lede">The vague line icons become small objects from the same lamp-lit desk as the subject art: brass, cream paper, charcoal and one touch of lime each. Buttons that only open, close or tick keep their plain marks.</p>
      </header>

      <section className="ics-sec" aria-labelledby="ics-set">
        <h2 id="ics-set">The set</h2>
        <ul className="ics-grid">
          {SET.map(({ name, label, was: Was, wasName, where }) => (
            <li key={name} className="ics-cell">
              <BrandIcon name={name} size={72} />
              <b>{label}</b>
              <span className="ics-was">{Was ? <Was size={14} strokeWidth={1.9} aria-hidden="true" /> : null}Was: {wasName}</span>
              <span className="ics-where">{where}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ics-sec" aria-labelledby="ics-sizes">
        <h2 id="ics-sizes">At their sizes</h2>
        <p className="ics-note">40 px in a list row, 32 px at the smallest. Below 32 px the object would blur, so the plain mark stays.</p>
        <div className="ics-sizes">
          {[32, 40, 56, 72].map((s) => (
            <div key={s} className="ics-size">
              <span className="ics-size__row">{['keycards', 'mistakes', 'compass', 'mob'].map((n) => <BrandIcon key={n} name={n} size={s} />)}</span>
              <span className="ics-size__px">{s} px</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ics-sec" aria-labelledby="ics-shelf">
        <h2 id="ics-shelf">In a row: the chapter shelf</h2>
        <ul className="ics-shelf">
          {SHELF.map((r) => (
            <li key={r.name}>
              <a className="ics-shelf__row" href={href({ view: 'learn2-chapter', chapter: 'accountancy.admission-of-partner' })}>
                <BrandIcon name={r.name} size={40} />
                <span className="ics-shelf__text"><b>{r.title}</b><span>{r.line}</span></span>
                <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" className="ics-chev" />
              </a>
            </li>
          ))}
        </ul>
        <p className="ics-links">
          See them live:{' '}
          <a href={href({ view: 'learn2-chapter', chapter: 'accountancy.admission-of-partner' })}>Chapter page</a> ·{' '}
          <a href={href({ view: 'learn2', subject: 'accountancy' })}>Learn home</a> ·{' '}
          <a href={href({ view: 'dashboard', data: 'ready' })}>Practice</a> ·{' '}
          <a href={href({ view: 'explore', data: 'ready' })}>Explore</a>
        </p>
      </section>

      <section className="ics-sec" aria-labelledby="ics-dock">
        <h2 id="ics-dock">The dock: a proposal, not swapped yet</h2>
        <p className="ics-note">Today the dock draws four outlines. Objects at 30 px are at their smallest; judge this one on your phone before it moves into the real dock.</p>
        <div className="ics-docks">
          <div className="ics-dock" aria-label="The dock today">
            <span><CalendarCheck size={24} strokeWidth={1.75} aria-hidden="true" />Today</span>
            <span><Timer size={24} strokeWidth={1.75} aria-hidden="true" />Practice</span>
            <span className="ics-dock__start"><i><Play size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" /></i>Start</span>
            <span><Users size={24} strokeWidth={1.75} aria-hidden="true" />Mob</span>
            <span><UserRound size={24} strokeWidth={1.75} aria-hidden="true" />You</span>
          </div>
          <div className="ics-dock ics-dock--obj" aria-label="The dock with objects">
            <span><BrandIcon name="today" size={32} />Today</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- the existing brass stopwatch, Practice's own object */}
            <span><img src="/mob/art/hybrid-stopwatch.webp" alt="" width={32} height={32} className="ics-dock__img" />Practice</span>
            <span className="ics-dock__start"><i><Play size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" /></i>Start</span>
            <span><BrandIcon name="mob" size={32} />Mob</span>
            <span><BrandIcon name="you" size={32} />You</span>
          </div>
        </div>
      </section>

      <section className="ics-sec" aria-labelledby="ics-mobi">
        <h2 id="ics-mobi">Ask Mobi: his face, not a speech bubble</h2>
        <div className="ics-mobi">
          <span className="ics-key ics-key--was"><MessageCircle size={16} strokeWidth={2.2} aria-hidden="true" />Ask Mobi what to practise</span>
          <span className="ics-key"><MobiMark size={20} />Ask Mobi what to practise</span>
        </div>
      </section>
    </div>
  );
}
