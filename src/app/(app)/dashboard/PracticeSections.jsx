"use client";

// The parts of the Practice page you can see (web IA plan 2.2 Practice, IA5), drawn from plain props.
// DashboardPageClient.jsx owns the state, the reads and the Start action; nothing here fetches.
//
// Top to bottom: Tonight's move (the recommended start), Your subjects, Session (with its cost on every
// row), Fine-tune, the session panel (confirm line and Start), and More ways to practise.
// Radio groups are native radios drawn as tiles and rows, so arrow keys and screen readers work as
// they do everywhere else. One filled button: Start (or See Pro when the session comes with Pro).
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { AppIcon, StatusIcon } from '@/components/ui/Glyph';
import { APPROVED } from '@/../data/glossary.mjs';
import { Button } from '@/components/ui/Button';
import { SubjectMark, Segmented } from './PracticeParts';
import { SESSION_LABEL, fineTuneHint, sameSetup, setupFromHref } from './practiceModel.mjs';

export const SUBJECTS_EDIT_HREF = '/onboarding?edit=true';

// ---------------------------------------------------------------------------------------------
// Notes: a linked subject that is not on the sheet, stale subjects, a length that was adjusted

export function Notes({ notes }) {
  if (!notes.length) return null;
  return (
    <div className="prc-notes">
      {notes.map((note) => (
        <div key={note.id} className="prc-note" data-tone={note.tone} role="status">
          <StatusIcon kind={note.tone === 'warning' ? 'warning' : 'info'} size={18} />
          <div>
            {note.title ? <b>{note.title}</b> : null}
            {note.body ? <p>{note.body}</p> : null}
            {note.list?.length ? <ul>{note.list.map((item) => <li key={item.id}><b>{item.name}:</b> {item.reason}</li>)}</ul> : null}
            {note.action ? <Link href={note.action.href}>{note.action.label}</Link> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 1. Tonight's move: the same move Today and the Start sheet show, set up in place

/**
 * `move` is nextMove() (data/next_step_rules.mjs); `current` is the session on screen. A move that is a
 * practice link sets this page up in place (nothing is spent); any other (resume, a result) is a link.
 */
export function Recommended({ status, move, current, onSetup }) {
  if (status === 'loading') {
    return (
      <section className="prc-reco prc-reco--loading" aria-busy="true" aria-label="Working out your next move">
        <div className="prc-reco__text" aria-hidden="true">
          <i className="prc-sk prc-sk--l1" />
          <i className="prc-sk prc-sk--l2" />
          <i className="prc-sk prc-sk--l3" />
        </div>
      </section>
    );
  }
  if (status !== 'ready' || !move) return null;
  const want = setupFromHref(move.primary.href);
  const here = want ? sameSetup(want, current) : false;
  return (
    <section className="prc-reco" aria-labelledby="prc-reco-title" data-move={move.id}>
      <div className="prc-reco__text">
        <p className="prc-reco__label">{move.label}</p>
        <h2 id="prc-reco-title" className="prc-reco__title">{move.title}</h2>
        {move.detail ? <p className="prc-reco__detail">{move.detail}</p> : null}
        {move.cost ? <p className="prc-reco__cost">{move.cost}</p> : null}
      </div>
      {want ? (
        here
          ? <p className="prc-reco__set" role="status"><Check size={16} strokeWidth={2} aria-hidden="true" />Set up in your session</p>
          : <button type="button" className="prc-key" onClick={() => onSetup(want)}>Set this up</button>
      ) : (
        <Link className="prc-key" href={move.primary.href}>{move.primary.label}</Link>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Your subjects

export function SubjectGroup({ subjects, value, onChange, counts, statsState, showArt }) {
  return (
    <section aria-labelledby="prc-subject-h">
      <div className="prc-sechead">
        <h2 className="prc-h" id="prc-subject-h">Your subjects</h2>
        <Link className="prc-link" href={SUBJECTS_EDIT_HREF}>Edit subjects</Link>
      </div>
      <fieldset className="prc-subjects" data-art={showArt ? 'true' : 'false'}>
        <legend className="sr-only">Subject</legend>
        {subjects.map((subject) => {
          const on = value === subject.id;
          const count = counts?.[subject.internalId || subject.id];
          const meta = statsState === 'ready' && Number.isFinite(Number(count)) ? `${Number(count).toLocaleString('en-IN')} questions` : '';
          return (
            <label key={subject.id} className="prc-tile" data-on={on ? 'true' : 'false'}>
              <input className="prc-pick" type="radio" name="prc-subject" value={subject.id} checked={on} onChange={() => onChange(subject.id)} />
              <SubjectMark id={subject.internalId || subject.id} showArt={showArt} />
              <span className="prc-tile__name">{subject.name}</span>
              <span className="prc-tile__meta">{meta}</span>
              <span className="prc-tile__tick" aria-hidden="true"><StatusIcon kind="check" size={14} /></span>
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Session: Quick practice, Full mock, NTA mode, Smart practice, each with its cost

export function SessionGroup({ rows, value, onChange, mode, count, onCount, minutes, pro, ntaScreen, onNtaScreen }) {
  const lengths = mode.fixedCount ? null : (mode.countOptions || []);
  return (
    <section aria-labelledby="prc-session-h">
      <div className="prc-sechead"><h2 className="prc-h" id="prc-session-h">Session</h2></div>
      <fieldset className="prc-sessions">
        <legend className="sr-only">Session</legend>
        {rows.map((row) => {
          const on = value === row.id;
          return (
            <label key={row.id} className="prc-row" data-on={on ? 'true' : 'false'} data-locked={row.locked ? 'true' : 'false'}>
              <input className="prc-pick" type="radio" name="prc-session" value={row.id} checked={on} onChange={() => onChange(row.id)} />
              <span className="prc-row__dot" aria-hidden="true" />
              <span className="prc-row__name">{row.label}{row.tag ? <span className="prc-tag"><AppIcon name="lock" size={12} />{row.tag}</span> : null}</span>
              <span className="prc-row__line">{row.line}</span>
              <span className="prc-row__cost">{row.cost}</span>
            </label>
          );
        })}
      </fieldset>
      {lengths ? (
        <div className="prc-field">
          <span className="prc-field__label">Questions<span className="prc-field__hint">About {minutes} minutes</span></span>
          <Segmented label="Number of questions" value={count} options={lengths.map((n) => ({ value: n, label: String(n) }))} onChange={onCount} />
        </div>
      ) : null}
      {mode.id === 'nta' && pro ? (
        <div className="prc-field">
          <span className="prc-field__label">Exam screen<span className="prc-field__hint">Same questions, timing and scoring. You can switch inside the test.</span></span>
          <Segmented label="Exam screen" value={ntaScreen} onChange={onNtaScreen}
            options={[{ value: 'mockmob', label: 'MockMob style' }, { value: 'nta', label: 'NTA style' }]} />
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Fine-tune: difficulty and chapters, both optional

export function FineTune({ open, onToggle, mode, pro, difficulty, onDifficulty, chapters, chaptersFailed, chapterSearch, onChapterSearch, selected, onToggleChapter, onAllChapters }) {
  const needle = chapterSearch.trim().toLowerCase();
  const shown = needle ? chapters.filter((chapter) => chapter.name?.toLowerCase().includes(needle)) : chapters;
  return (
    <details className="prc-fine" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <h2 className="prc-h">Fine-tune</h2>
        <span className="prc-fine__hint">{fineTuneHint({ difficulty, chapters: selected })}</span>
        <AppIcon name="expand" size={16} className="prc-fine__chev" />
      </summary>
      {mode.allowDifficultyOverride ? (
        <div className="prc-fine__block">
          <div className="prc-fine__label">Difficulty{!pro ? <span className="prc-tag"><AppIcon name="lock" size={12} />{APPROVED.proLock}</span> : null}</div>
          <Segmented label="Difficulty" value={difficulty} disabledValues={pro ? [] : ['easy', 'medium', 'hard']} onChange={onDifficulty}
            options={['auto', 'easy', 'medium', 'hard'].map((d) => ({ value: d, label: d === 'auto' ? 'Balanced' : d[0].toUpperCase() + d.slice(1) }))} />
        </div>
      ) : null}
      {chapters.length > 0 ? (
        <div className="prc-fine__block">
          <div className="prc-fine__label">Chapters</div>
          <label className="sr-only" htmlFor="prc-chapter-search">Search chapters</label>
          <input id="prc-chapter-search" className="input" value={chapterSearch} onChange={(event) => onChapterSearch(event.target.value)} placeholder="Search chapters" autoComplete="off" />
          <div className="prc-chapters">
            <button type="button" aria-pressed={selected.length === 0} onClick={onAllChapters}>All chapters</button>
            {shown.map((chapter) => (
              <button key={chapter.id || chapter.name} type="button" aria-pressed={selected.includes(chapter.name)} title={chapter.name} onClick={() => onToggleChapter(chapter.name)}>{chapter.name}</button>
            ))}
            {shown.length === 0 ? <p className="prc-fine__note">No chapter matches that search.</p> : null}
          </div>
        </div>
      ) : chaptersFailed ? (
        <p className="prc-fine__note" role="status">Chapters did not load. You can still practise all chapters.</p>
      ) : null}
    </details>
  );
}

// ---------------------------------------------------------------------------------------------
// 5. The session panel: what it takes, and Start

/**
 * Props: `view` is the model's answer for the session on screen:
 *   { title, line, scope, locked, upgradeHref, alternative, statusText, note, canRetry }
 * The Start key's state: launching, checking, available.
 */
export function SessionPanel({ panelRef, titleRef, view, flash, launching, checking, available, startLabel, onStart, onSwitch, onRecheck }) {
  const { title, line, scope, locked, upgradeHref, alternative, statusText, note } = view;
  const alt = alternative ? SESSION_LABEL[alternative] : null;
  return (
    <aside className="prc-aside" ref={panelRef} aria-labelledby="prc-session-title" data-flash={flash ? 'true' : undefined}>
      <h2 id="prc-session-title" ref={titleRef} tabIndex={-1} className="prc-aside__title">{title}</h2>
      <div className="prc-aside__swap" key={`${view.key}`}>
        <p className="prc-aside__line">{line}</p>
        {scope ? <p className="prc-aside__scope">{scope}</p> : null}
      </div>
      <p className="prc-aside__status" role="status" aria-live="polite" data-tone={note?.tone || undefined}>
        {statusText}
        {!statusText && note?.text ? note.text : null}
        {note?.retry || view.canRetry ? <> <button type="button" onClick={onRecheck}>Check again</button></> : null}
      </p>
      {locked ? (
        <div className="prc-aside__alts">
          <Link className="btn-volt md mk-press prc-start" href={upgradeHref}>See Pro</Link>
          {alt ? <button type="button" className="prc-key" onClick={() => onSwitch(alternative)}>Set up {alt.toLowerCase()} instead</button> : null}
        </div>
      ) : (
        <>
          <Button variant="volt" size="md" className="prc-start" disabled={launching || checking || !available} onClick={onStart}>
            <AppIcon name="practice" size={18} />{startLabel}
          </Button>
          {note?.href ? <div className="prc-aside__alts"><Link className="prc-key" href={note.href}>{note.hrefLabel || 'See Pro'}</Link></div> : null}
        </>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------------------------
// 6. More ways to practise: Question stream, and Concepts while the study flags are on

export function MorePractice({ studyEnabled }) {
  const items = [
    { id: 'stream', name: APPROVED.stream, line: 'Untimed questions, one at a time, with the reasoning after each answer.', href: '/explore' },
    ...(studyEnabled ? [{ id: 'concepts', name: APPROVED.lessons, line: 'Short lessons, then questions on the same concept.', href: '/learn' }] : []),
  ];
  return (
    <section className="prc-more" aria-labelledby="prc-more-h">
      <div className="prc-sechead"><h2 className="prc-h" id="prc-more-h">More ways to practise</h2></div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href}>
              <span className="prc-more__text"><b>{item.name}</b><span>{item.line}</span></span>
              <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Empty: no practice subjects on the sheet

export function NoSubjects({ staleOnly }) {
  return (
    <section className="prc-empty" aria-labelledby="prc-empty-h">
      <h2 id="prc-empty-h">{staleOnly ? 'Choose a subject with practice' : 'Pick your subjects first'}</h2>
      <p>{staleOnly ? 'None of your saved subjects has practice yet. Add a CUET subject that does, and it appears here.' : 'Choose the CUET UG subjects you are taking. Practice is set up from them.'}</p>
      <Link className="btn-volt md mk-press" href={SUBJECTS_EDIT_HREF}>Edit subjects</Link>
    </section>
  );
}

