"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): its keys are drawn here

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Icon } from '@/components/ui/Icons';
import { DAILY_FIVE_SIZE, dayNumber } from '@/lib/dailyFive.mjs';
import { TEAM_COLLEGES, searchTeams, teamName } from '@/lib/daily/colleges.mjs';
import {
  AVG_RULE, BOARD_PREVIEW, BOARD_RULE, CHANGE_RULE, SUNDAY_RULE, TEAM_STORE, WEEK_RULE, acceptBoard, avgWords, boardRows, canChange, emptyBoardLine,
  lockLine, mergeTeam, perPlayerWords, pickTeam, readTeam,
} from '@/lib/daily/team.mjs';
import { dateLabel, timeLabel } from '@/lib/sundayMock.mjs';
import './daily-team.css';

// Playing for a college (17 Nov 2026, lane daily; the rules are src/lib/daily/team.mjs). The parts the home page's block
// (DailyFiveRow.jsx) and /daily (DailyFive.jsx) share:
//   useTeamChoice   the college this device plays for, beside the account's (the account wins unless a change was made here
//                   after its latest five), with the once-a-week rule
//   useBoard        GET /api/daily/board, read once the board is near the screen
//   CollegeSheet    "Who are you playing for?": a short list (the student's own colleges first, then the home page's DU
//                   colleges) and a search over all 67; a college is marked like an answer on an OMR sheet; one key
//   CollegeBoard    the board: colleges, never people. Today (by players), the week (days a player), the Sunday Mock
//                   (average marks). The student's own college always has its row.
//   OmrFive         the five as answer bubbles: open, the one being answered, right or missed
// Nothing here moves by itself: the sheet rises when it is opened and that is all.

const TEAM_EVENT = 'mm:daily-team';
const readDevice = () => { try { return readTeam(window.localStorage.getItem(TEAM_STORE)); } catch { return null; } };
const writeDevice = (choice) => {
  try { if (choice) window.localStorage.setItem(TEAM_STORE, JSON.stringify(choice)); } catch { /* this visit only */ }
  window.dispatchEvent(new Event(TEAM_EVENT));
};

/**
 * The college this device plays for. `today` is the IST date (null before the clock is read); `account` is /api/daily/me's
 * team (signed in), or null; `userId` the signed-in student, or null. { ready, choice, college, changeable, lock,
 * pick(college) }. `ready` is false until the device has been read after the first paint (the server has no device). A
 * choice is kept with the account it belongs to (`by`), so on a shared phone one student's college and its weekly lock never
 * become another's (team.mjs mergeTeam).
 */
export function useTeamChoice({ today = null, account = null, userId = null } = {}) {
  const [device, setDevice] = useState(undefined);
  useEffect(() => {
    const read = () => setDevice(readDevice());
    const t = window.setTimeout(read, 0);
    const onStorage = (e) => { if (!e.key || e.key === TEAM_STORE) read(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(TEAM_EVENT, read);
    return () => { window.clearTimeout(t); window.removeEventListener('storage', onStorage); window.removeEventListener(TEAM_EVENT, read); };
  }, []);
  const by = typeof userId === 'string' && userId ? userId : null;
  const choice = device === undefined ? null : mergeTeam(device, account, by);
  // The account's college, once read, is this device's too, kept as this account's.
  useEffect(() => {
    if (device === undefined || !account || !choice) return;
    if (!device || device.college !== choice.college || device.changedOn !== choice.changedOn || device.on !== choice.on || (device.by || null) !== by) {
      writeDevice({ ...choice, ...(by ? { by } : {}) });
    }
  }, [device, account, choice, by]);
  const held = useRef(null);
  useEffect(() => { held.current = choice; });
  const pick = useCallback((college) => {
    if (!today) return null;
    const next = pickTeam(held.current, college, today);
    if (next && next !== held.current) writeDevice({ ...next, ...(by ? { by } : {}) });
    return next;
  }, [today, by]);
  return {
    ready: device !== undefined,
    choice,
    college: choice?.college || null,
    changeable: Boolean(today) && canChange(choice, today),
    lock: today ? lockLine(choice, today) : '',
    pick,
  };
}

/** The board for `date`, read once `active` (near the screen). { state: 'idle' | 'loading' | 'ready' | 'failed', board, retry }. */
export function useBoard(date, active = true) {
  const [state, setState] = useState({ state: 'idle', board: null, date: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || !date) return undefined;
    let alive = true;
    const t = window.setTimeout(() => {
      setState((s) => (s.date === date && s.state === 'ready' ? s : { state: 'loading', board: null, date }));
      fetch(`/api/daily/board?day=${dayNumber(date)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => { if (!alive) return; const board = acceptBoard(body, date); setState(board ? { state: 'ready', board, date } : { state: 'failed', board: null, date }); })
        .catch(() => { if (alive) setState({ state: 'failed', board: null, date }); });
    }, 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, [active, date, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, state: state.date === date ? state.state : 'idle', retry };
}

// ---------------------------------------------------------------------------------------------------------------------
// The answer bubbles.

/** The five as OMR bubbles. marks[i]: true right, false missed, null open; `current` rings the one being answered. */
export function OmrFive({ marks = null, current = null, size = 'm', label }) {
  return (
    <p className="dt-omr" data-size={size} role="img" aria-label={label}>
      {Array.from({ length: DAILY_FIVE_SIZE }, (_, i) => {
        const mark = marks ? marks[i] : null;
        const state = mark === true ? 'right' : mark === false ? 'miss' : current === i ? 'now' : 'open';
        return (
          <span key={i} className="dt-omr__b" data-state={state}>
            {state === 'right' ? <Icon name="check" className="dt-omr__icon" /> : state === 'miss' ? <Icon name="x" className="dt-omr__icon" /> : <span>{i + 1}</span>}
          </span>
        );
      })}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// "Playing for": the field on the admit card, and the sheet it opens.

/**
 * The card's "Playing for" field. A button while the college can be chosen or changed; otherwise the college and the day it
 * can change again. `onOpen` opens the sheet.
 */
export function PlayingFor({ team, onOpen, compact = false }) {
  const name = team.college ? teamName(team.college) : '';
  const body = (
    <>
      <span className="dt-for__label">Playing for</span>
      <span className="dt-for__name" data-empty={name ? undefined : 'true'}>{name || (team.ready ? 'No college yet' : ' ')}</span>
      {team.ready && team.changeable ? <span className="dt-for__go">{name ? 'Change' : 'Choose'}</span> : null}
    </>
  );
  return (
    <div className="dt-for" data-compact={compact ? 'true' : undefined}>
      {team.ready && team.changeable
        ? <button type="button" className="dt-for__field" onClick={onOpen} aria-haspopup="dialog">{body}</button>
        : <div className="dt-for__field" data-still="true">{body}</div>}
      {team.ready && !team.changeable && team.lock ? <p className="dt-for__lock">{team.lock}</p> : null}
    </div>
  );
}

/**
 * "Who are you playing for?" A modal sheet: the short list (the student's own colleges first), a search over all 67, one
 * college marked like an answer bubble, one key. mode 'pick' (the key chooses it) or 'start' (the key chooses it and starts
 * today's five; a quiet second key plays without a college). `first` are ids from My colleges, the first preselected.
 */
export function CollegeSheet({ open, onClose, onChoose, current = null, first = [], mode = 'pick', onSkip = null }) {
  const ref = useRef(null);
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const t = window.setTimeout(() => {
        setQuery('');
        setSel(current || first.find((id) => TEAM_COLLEGES.some((c) => c.id === id)) || null);
      }, 0);
      try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
      return () => window.clearTimeout(t);
    }
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open, current, first]);
  // The page does not scroll under the open sheet. Told on <html> as a plain attribute (daily-team.css): the sheet used to be
  // found with html:has(.mm .dt-sheet[open]), and a :has() with an attribute inside is rescanned by the browser on every
  // DOM change anywhere on the page (19 Nov 2026, owner LK326).
  useEffect(() => {
    if (!open) return undefined;
    document.documentElement.setAttribute('data-dt-sheet', 'open');
    return () => document.documentElement.removeAttribute('data-dt-sheet');
  }, [open]);
  const list = useMemo(() => searchTeams(query, first), [query, first]);
  const mine = new Set(first);
  const choose = () => { if (sel) onChoose(sel); };
  const name = sel ? teamName(sel) : '';
  return (
    <dialog
      ref={ref}
      className="dt-sheet"
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="dt-sheet__panel">
        <div className="dt-sheet__head">
          <h2 className="dt-sheet__title" id={titleId}>Who are you playing for?</h2>
          <button type="button" className="dt-sheet__close" onClick={onClose} aria-label="Close"><X size={20} strokeWidth={2.2} aria-hidden="true" /></button>
          <p className="dt-sheet__lead">Pick the DU college you’re aiming for. Every five you play signed in counts for it on the college board.</p>
        </div>
        <label className="dt-sheet__search">
          <Search size={18} strokeWidth={2.2} aria-hidden="true" />
          <span className="sr-only">Search 67 DU colleges</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search 67 DU colleges" autoComplete="off" enterKeyHint="search" spellCheck={false} />
        </label>
        <div className="dt-sheet__list" role="radiogroup" aria-label="DU colleges">
          {list.length ? list.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={sel === c.id} className="dt-pick" onClick={() => setSel(c.id)}>
              <span className="dt-pick__b" aria-hidden="true">{sel === c.id ? <Icon name="check" className="dt-pick__icon" /> : null}</span>
              <span className="dt-pick__name">{c.name}</span>
              {mine.has(c.id) ? <span className="dt-pick__tag">In your colleges</span> : null}
            </button>
          )) : <p className="dt-sheet__none">No DU college matches “{query.trim()}”.</p>}
          {!query.trim() ? <p className="dt-sheet__more">Search to find any of the 67.</p> : null}
        </div>
        <div className="dt-sheet__foot">
          <p className="dt-sheet__rule">{CHANGE_RULE}</p>
          <button type="button" className="mm-btn mm-btn--primary dt-sheet__go" onClick={choose} disabled={!sel}>
            {sel ? `${mode === 'start' ? 'Play for' : 'Choose'} ${name}` : 'Pick a college'}
          </button>
          {mode === 'start' && onSkip ? <button type="button" className="dt-sheet__skip" onClick={onSkip}>Play without a college</button> : null}
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The board.

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'sunday', label: 'Sunday' },
];

function Rows({ rows, kind, compact = false }) {
  // The bar draws the figure the row ranks by (a week's by days each; a row under its floor has no figure, so no bar).
  const sizeOf = (r) => (kind === 'sunday' ? (r.avg ?? 0) : kind === 'week' ? (r.perPlayer ?? 0) : r.players);
  const top = Math.max(1e-9, ...rows.map(sizeOf));
  return (
    <ol className="dt-rows" data-compact={compact ? 'true' : undefined}>
      {rows.map((r, i) => {
        const gap = i > 0 && r.place > rows[i - 1].place + 1;
        const under = kind === 'week' && r.perPlayer === null;
        const fig = kind === 'sunday' ? (r.avg === null ? null : String(r.avg)) : kind === 'week' ? (under ? String(r.players) : String(r.perPlayer)) : String(r.players);
        const unit = kind === 'sunday' ? (r.avg === null ? '' : `of ${r.max}`) : kind === 'week' ? (under ? (r.players === 1 ? 'player' : 'players') : 'days each') : 'played';
        const sub = kind === 'sunday' ? `${r.sitters} sat it` : kind === 'week' ? (under ? `${r.days} ${r.days === 1 ? 'five' : 'fives'} so far` : `${r.players} ${r.players === 1 ? 'player' : 'players'}, ${r.days} ${r.days === 1 ? 'five' : 'fives'}`) : avgWords(r.avg);
        const size = sizeOf(r);
        return (
          <li key={r.college} className="dt-row" data-mine={r.mine ? 'true' : undefined} data-gap={gap ? 'true' : undefined}>
            <span className="dt-row__place">{r.place}</span>
            <span className="dt-row__name">
              {teamName(r.college)}
              {r.mine ? <span className="dt-row__you">Your college</span> : null}
            </span>
            <span className="dt-row__fig">{fig !== null ? <><b>{fig}</b><small>{unit}</small></> : <small>{sub}</small>}</span>
            <span className="dt-row__bar" aria-hidden="true"><i style={{ transform: `scaleX(${size > 0 ? Math.max(0.03, size / top) : 0})` }} /></span>
            {fig !== null && sub && !compact ? <span className="dt-row__sub">{sub}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function SundayPart({ sunday, mine, top }) {
  if (!sunday) return <p className="dt-board__empty">The Sunday Mock’s board shows here after its answers open.</p>;
  if (sunday.state === 'first') {
    return <p className="dt-board__empty">The first Sunday Mock is on {dateLabel(sunday.week)}. Its college board opens at {timeLabel(sunday.at).toLowerCase()} that night: each college’s average marks, once 5 of its students have sat it.</p>;
  }
  if (!sunday.colleges.length) return <p className="dt-board__empty">No one who sat the Sunday Mock on {dateLabel(sunday.week)} played for a college.</p>;
  return (
    <>
      <p className="dt-board__when">{dateLabel(sunday.week)}</p>
      <Rows rows={boardRows(sunday.colleges, mine, top)} kind="sunday" />
    </>
  );
}

/**
 * The college board. mode 'preview' (the home page: today's first three and the student's own) or 'full' (/daily: today,
 * the week and the Sunday Mock as tabs, the first ten and the student's own). `load` is useBoard's answer.
 */
export function CollegeBoard({ load, mine = null, mode = 'full', headingId, title = 'College board', more = null, aside = null }) {
  const [tab, setTab] = useState('today');
  const [all, setAll] = useState(false);
  const base = useId();
  const preview = mode === 'preview';
  const top = preview ? BOARD_PREVIEW : all ? 67 : 10;
  const board = load?.board || null;
  const state = load?.state || 'idle';

  let body = null;
  if (state === 'failed') {
    body = (
      <p className="dt-board__empty">The board didn’t load. <button type="button" className="dt-board__again" onClick={load.retry}>Try again</button></p>
    );
  } else if (!board) {
    // Loading: three still rows that hold the board's height (nothing shimmers).
    body = <ol className="dt-rows" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} className="dt-row" data-still="true"><span className="dt-row__place">&nbsp;</span><span className="dt-row__name">&nbsp;</span><span className="dt-row__bar"><i style={{ transform: `scaleX(${0.8 - i * 0.22})` }} /></span></li>)}</ol>;
  } else if (preview || tab === 'today') {
    const rows = boardRows(board.today.colleges, mine, top);
    body = rows.length ? <Rows rows={rows} kind="today" compact={preview} /> : <p className="dt-board__empty">{emptyBoardLine(mine)}</p>;
  } else if (tab === 'week') {
    const rows = boardRows(board.week.colleges, mine, top);
    body = rows.length ? <Rows rows={rows} kind="week" /> : <p className="dt-board__empty">No one has played for a college this week yet.</p>;
  } else {
    body = <SundayPart sunday={board.sunday} mine={mine} top={top} />;
  }
  const count = !board ? 0 : tab === 'week' ? board.week.colleges.length : tab === 'sunday' ? (board.sunday?.colleges?.length || 0) : board.today.colleges.length;
  const rule = preview ? 'Today, by how many signed-in students play for each.' : tab === 'week' ? WEEK_RULE : tab === 'sunday' ? SUNDAY_RULE : `${BOARD_RULE} ${AVG_RULE}`;
  return (
    <section className="dt-board" data-mode={mode} aria-labelledby={headingId || `${base}-h`}>
      <div className="dt-board__head">
        <h3 className="dt-board__title" id={headingId || `${base}-h`}>{title}</h3>
        {aside}
        {preview ? <p className="dt-board__rule">{rule}</p> : null}
      </div>
      {!preview ? (
        <div className="dt-tabs" role="tablist" aria-label="Which board">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`${base}-${t.id}`} aria-selected={tab === t.id} aria-controls={`${base}-panel`} className="dt-tab" onClick={() => { setTab(t.id); setAll(false); }}>{t.label}</button>
          ))}
        </div>
      ) : null}
      <div className="dt-board__panel" id={`${base}-panel`} role={preview ? undefined : 'tabpanel'} aria-labelledby={preview ? undefined : `${base}-${tab}`} aria-live="polite">
        {body}
        {!preview && board && count > top ? <button type="button" className="dt-board__all" onClick={() => setAll(true)}>Show all {count} colleges</button> : null}
      </div>
      {!preview ? <p className="dt-board__rule">{rule}</p> : null}
      {more}
    </section>
  );
}

/** Today's numbers in one sentence for a screen reader and the result: "38 signed-in students played today, 31 for a college." */
export function boardTotals(board) {
  if (!board) return '';
  const { players, counted } = board.today;
  if (!players) return '';
  return `${players} signed-in ${players === 1 ? 'student' : 'students'} played today, ${counted} for a college.`;
}
