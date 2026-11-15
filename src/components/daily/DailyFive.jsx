"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';
import { FIRST_SET_LABEL, firstSetHref } from '@/lib/firstSet.mjs';
import {
  DAILY_FIVE_SIZE, DAILY_FIVE_STORE, acceptDailyFive, adoptAccount, beginRun, clockWords, dailyFiveUrl, dayLabel, dropForeign, finishDay,
  formatClock, keepAnswer, markSaved, msUntilNextDay, nextIndex, readRecord, resultFor, scoreRun, shareText, shortDate, streakLine, streakOf,
  todayDaily, untilWords,
} from '@/lib/dailyFive.mjs';
import {
  ANSWER_LETTERS, DAILY_FIVE_ME_ROUTE, DAILY_FIVE_STATS_ROUTE, acceptAccount, acceptCrowd, crowdLineFor, runDays, runNote,
} from '@/lib/dailyFiveAccount.mjs';
import '@/components/landing/demo-subject.css';
import './daily.css';

// The Daily Five at /daily (15 Nov 2026, lane F-A; the account, lane daily; the models are src/lib/dailyFive.mjs and
// src/lib/dailyFiveAccount.mjs). The same five CUET questions for everyone today, one at a time, in the home page sample card's
// own look and behaviour: the same classes (lp-card, mm-drill__*) inside the same .lp-try .lp-desk frame, so every rule of the
// sample (marketing.css, hero-scene.css, r10-sample.css, r13-motion.css, demo-subject.css) draws it; daily.css only frees the
// card from Mobi's room and adds the clock, the squares, the share and the question list.
// States: loading (the sample's own skeleton), failed (one line and Try again), start (what the five are, one volt Start),
// playing (the clock counts up; each answer shows its reason, as the sample does), result (score, time, the five squares, the
// volt Share, the run of days, the five questions one by one with how everyone did, one quiet key on), and played (today's
// result again with the wait for the next five). A day is played once on a device: a reload resumes the run where it stood,
// with the clock still running, and an answer is never asked again (DAILY_FIVE_STORE in localStorage).
// Signed in: the finished five is saved to the account (POST /api/daily/me, scored by the server), and the account's record
// wins over the device's: a five finished on another phone shows here as played, and the run of days is the account's. A
// save that fails says so under the run, with Try again; nothing says "saved" before the server has it. Guests: unchanged.

const KEYS = ['A', 'B', 'C', 'D'];
/** A request that has not answered in this long is dropped and the page offers Try again (the sample's patchy-4G rule). */
const SLOW_MS = 8000;
const LONG_STEM = 110;

/** The wall clock, read in event handlers and timers only (never during render). */
const clockNow = () => Date.now();

const readStore = () => { try { return readRecord(window.localStorage.getItem(DAILY_FIVE_STORE)); } catch { return readRecord(null); } };
const writeStore = (record) => { try { window.localStorage.setItem(DAILY_FIVE_STORE, JSON.stringify(record)); } catch { /* this visit only */ } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const todayDateOf = (today) => (today && typeof today.date === 'string' ? today.date : null);

/** Where a key must sit to be reachable: the window's foot (this page has no phone bar). */
const reachLimit = () => window.innerHeight;

/** "3 English, 2 General Test": what today's five hold, from the five themselves. */
function mixLine(questions) {
  const counts = new Map();
  for (const q of questions) counts.set(q.subject, (counts.get(q.subject) || 0) + 1);
  return [...counts].map(([name, n]) => `${n} ${name}`).join(', ');
}

/** The five squares on screen: what the share line sends, drawn. */
function Squares({ marks, label }) {
  return (
    <p className="dly__squares" role="img" aria-label={label}>
      {marks.map((right, i) => <span key={i} className="dly__square" data-right={right ? 'true' : 'false'} />)}
    </p>
  );
}

const squaresLabel = (marks) => marks.map((right, i) => `question ${i + 1} ${right ? 'right' : 'missed'}`).join(', ');

export default function DailyFive() {
  const { isAuthenticated, status, user } = useAuth();
  const userId = isAuthenticated && user?.id ? String(user.id) : null;
  const signedIn = Boolean(userId);
  const authKnown = status !== 'loading';
  // phase: 'loading' | 'failed' | 'start' | 'playing' | 'result'
  const [phase, setPhase] = useState('loading');
  const [failure, setFailure] = useState(null); // 'offline' | 'slow' | 'error'
  const [today, setToday] = useState(null); // { day, date } (the server's, once the five arrive)
  const [five, setFive] = useState(null);
  const [record, setRecord] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [now, setNow] = useState(0);
  const [openRow, setOpenRow] = useState(null);
  const [share, setShare] = useState('idle'); // 'idle' | 'copied' | 'failed'
  const [justFinished, setJustFinished] = useState(false);
  // The account (signed in only): { state: 'loading' | 'ready' | 'failed', date, record, played }.
  const [account, setAccount] = useState(null);
  // The save of today's five: 'idle' | 'saving' | 'saved' | 'failed' | 'device'.
  const [saving, setSaving] = useState('idle');
  const [crowd, setCrowd] = useState(null);
  const rootRef = useRef(null);
  const footRef = useRef(null);
  const optionsRef = useRef(null);
  const resultRef = useRef(null);
  const focusNext = useRef(null);
  const request = useRef(null);
  const saveFor = useRef(null);
  const fiveRef = useRef(null);
  const accountRef = useRef(null);
  const leadId = useId();

  const run = record?.run && today && record.run.date === today.date ? record.run : null;
  const result = record && today ? resultFor(record, today.date, userId) : null;
  const accountReady = account?.state === 'ready' && today && account.date === today.date;
  const accountRecord = accountReady ? account.record : null;

  // The account wins: its record for its day replaces the device's, rebuilt from the account's own answers and, once the page
  // holds them, the five (the misses and the chapters).
  const applyAccount = useCallback((acc, uid) => {
    if (!acc?.record || !uid) return;
    const stored = readStore();
    const adopted = adoptAccount(stored, acc.record, { userId: uid, questions: fiveRef.current });
    if (!same(adopted, stored)) { writeStore(adopted); setRecord(adopted); }
  }, []);

  // Load today: the device's record first (a finished day shows at once), then the five (for a finished day, quietly: they
  // name the questions in the list and let a signed-in student's result be saved).
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const stored = readStore();
    const local = todayDaily(clockNow());
    const finished = Boolean(resultFor(stored, local.date, null));
    setRecord(stored);
    setToday(local);
    setNow(clockNow());
    setFailure(null);
    setPhase(finished ? 'result' : 'loading');
    let slow = false;
    const timer = window.setTimeout(() => { slow = true; controller.abort(); }, SLOW_MS);
    try {
      let response = await fetch(dailyFiveUrl(local.day), { signal: controller.signal });
      // A device clock on the wrong side of midnight: the server names today, and the page asks once more for it.
      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        if (Number.isInteger(body?.day) && body.day !== local.day) response = await fetch(dailyFiveUrl(body.day), { signal: controller.signal });
      }
      const accepted = acceptDailyFive(response.ok ? await response.json() : null);
      window.clearTimeout(timer);
      if (request.current !== controller) return;
      if (!accepted) throw new Error('unavailable');
      request.current = null;
      const day = { day: accepted.day, date: accepted.date };
      setToday(day);
      fiveRef.current = accepted.questions;
      setFive(accepted.questions);
      setNow(clockNow());
      const held = accountRef.current;
      if (held?.state === 'ready' && held.date === day.date && held.record) applyAccount(held, held.userId);
      if (resultFor(stored, day.date, null)) { setPhase('result'); return; }
      const begun = stored.run && stored.run.date === day.date ? stored.run : null;
      if (begun) {
        const at = nextIndex(begun.picks);
        if (at >= DAILY_FIVE_SIZE) {
          // All five were answered before the page closed: the day is finished as it stood.
          const scored = scoreRun(begun.picks, accepted.questions);
          const done = finishDay(stored, { date: day.date, ...scored, ms: clockNow() - begun.startedAt });
          writeStore(done);
          setRecord(done);
          setPhase('result');
          return;
        }
        setIndex(at);
        setPicked(null);
        setPhase('playing');
        return;
      }
      setPhase('start');
    } catch {
      window.clearTimeout(timer);
      if (request.current !== controller) return;
      request.current = null;
      if (finished) return; // the result stands without them
      setFailure(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : slow ? 'slow' : 'error');
      setPhase('failed');
    }
  }, [applyAccount]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => { window.clearTimeout(t); request.current?.abort(); request.current = null; };
  }, [load]);

  // A finished day on this device that another account played: this student plays their own five here.
  useEffect(() => {
    const date = todayDateOf(today);
    if (!userId || !date) return undefined;
    const t = window.setTimeout(() => {
      const stored = readStore();
      const cleared = dropForeign(stored, date, userId);
      if (cleared !== stored) { writeStore(cleared); setRecord(cleared); }
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId, today]);

  // The account: today's record and the days played. Read once a day per visit; Try again reads it again.
  const holdAccount = useCallback((next) => { accountRef.current = next; setAccount(next); }, []);
  const readAccount = useCallback(async (date, uid) => {
    holdAccount({ state: 'loading', date, userId: uid });
    try {
      const response = await fetch(DAILY_FIVE_ME_ROUTE, { cache: 'no-store' });
      const body = response.ok ? acceptAccount(await response.json()) : null;
      const next = body && body.date === date ? { state: 'ready', userId: uid, ...body } : { state: 'failed', date, userId: uid };
      holdAccount(next);
      applyAccount(next, uid);
    } catch {
      holdAccount({ state: 'failed', date, userId: uid });
    }
  }, [applyAccount, holdAccount]);
  const todayDate = today?.date || null;
  useEffect(() => {
    if (!userId || !todayDate) return undefined;
    const t = window.setTimeout(() => readAccount(todayDate, userId), 0);
    return () => window.clearTimeout(t);
  }, [userId, todayDate, readAccount]);

  // The save: a finished five of this student's, not on the account yet, with the server's tokens. Once per day per visit
  // (Try again clears the mark); the server keeps the first run whatever is sent after it.
  const save = useCallback(async (date) => {
    const stored = readStore();
    const last = resultFor(stored, date, userId);
    const tokens = Array.isArray(five) ? five.map((q) => q.token) : [];
    if (!last || !last.picks || tokens.length !== DAILY_FIVE_SIZE || tokens.some((t) => !t)) { setSaving('device'); return; }
    setSaving('saving');
    try {
      const response = await fetch(DAILY_FIVE_ME_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: last.day, date, tokens, answers: last.picks.map((p) => ANSWER_LETTERS[p]), ms: last.ms }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 409) { setSaving('device'); return; }
      const answer = response.ok ? acceptAccount(body) : null;
      if (!answer?.record) throw new Error('unsaved');
      const marked = markSaved(readStore(), date, userId);
      writeStore(marked);
      setRecord(marked);
      // The stored record is the first run's, wherever it was finished: it is the one shown.
      const next = { state: 'ready', userId, day: answer.day, date: answer.date, record: answer.record, played: answer.played.length ? answer.played : runDays(accountRef.current?.played, date, true) };
      holdAccount(next);
      applyAccount(next, userId);
      setSaving('saved');
    } catch {
      setSaving('failed');
    }
  }, [five, userId, applyAccount, holdAccount]);

  useEffect(() => {
    if (!signedIn || !today || !result || accountRecord || result.saved) return undefined;
    if (!account || account.state === 'loading' || !five) return undefined;
    if (saveFor.current === today.date) return undefined;
    saveFor.current = today.date;
    const t = window.setTimeout(() => save(today.date), 0);
    return () => window.clearTimeout(t);
  }, [signedIn, today, result, accountRecord, account, five, save]);

  const retrySave = () => {
    if (!today) return;
    saveFor.current = null;
    setSaving('idle');
    if (account?.state === 'failed' && userId) readAccount(today.date, userId);
    else save(today.date);
  };

  // The clock: it only counts up, from the moment Start was pressed, and stops at the fifth answer.
  const showResult = Boolean(result) && phase !== 'playing';
  const ticking = phase === 'playing' && Boolean(run) && !result;
  useEffect(() => {
    if (!ticking) return undefined;
    const id = window.setInterval(() => setNow(clockNow()), 500);
    return () => window.clearInterval(id);
  }, [ticking]);

  // The wait for the next five, in words, kept current; at 12:00 am IST the new day loads.
  useEffect(() => {
    if (!showResult || !today) return undefined;
    const id = window.setInterval(() => {
      const t = clockNow();
      setNow(t);
      if (todayDaily(t).date !== today.date) {
        saveFor.current = null;
        holdAccount(null);
        setSaving('idle');
        setCrowd(null);
        load();
      }
    }, 30 * 1000);
    return () => window.clearInterval(id);
  }, [showResult, today, load, holdAccount]);

  // How everyone did: read once the result is on screen (guests too). A failed read shows nothing extra.
  useEffect(() => {
    if (!showResult || !today || crowd) return undefined;
    let alive = true;
    fetch(`${DAILY_FIVE_STATS_ROUTE}?day=${today.day}`).then((r) => (r.ok ? r.json() : null)).then((body) => {
      const accepted = acceptCrowd(body, today.date);
      if (alive && accepted) setCrowd(accepted);
    }).catch(() => {});
    return () => { alive = false; };
  }, [showResult, today, crowd]);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'next') footRef.current?.querySelector('.mm-btn')?.focus({ preventScroll: true });
    else if (target === 'options') optionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
    else if (target === 'card') rootRef.current?.focus({ preventScroll: true });
    else if (target === 'result') resultRef.current?.focus({ preventScroll: true });
  }, [phase, index, picked]);

  // After an answer the reason opens and the forward key can fall under the window's foot: bring only the key into reach, at
  // once (the sample's rule: never a glide, nothing moves when it is already in reach).
  useEffect(() => {
    if (picked === null) return undefined;
    const id = window.setTimeout(() => {
      const key = footRef.current?.querySelector('.mm-btn');
      if (!key) return;
      const over = key.getBoundingClientRect().bottom - (reachLimit() - 12);
      if (over > 0) window.scrollBy({ top: Math.ceil(over), behavior: 'instant' });
    }, 320);
    return () => window.clearTimeout(id);
  }, [picked, index]);

  function start(event) {
    const next = beginRun(dropForeign(readStore(), today.date, userId), { date: today.date, startedAt: clockNow() });
    writeStore(next);
    setRecord(next);
    setIndex(0);
    setPicked(null);
    setNow(clockNow());
    focusNext.current = event.detail === 0 ? 'options' : 'card';
    setPhase('playing');
  }

  function pick(optionIndex, event) {
    if (picked !== null || !run) return;
    focusNext.current = event.detail === 0 ? 'next' : 'card';
    // Kept before it is shown: a reload after this answer resumes on the next question, never this one again.
    let next = keepAnswer(readStore(), { date: today.date, index, pick: optionIndex });
    if (nextIndex(next.run?.picks) >= DAILY_FIVE_SIZE) {
      // The fifth answer stops the clock and finishes the day at once (and a signed-in student's save starts); "See my
      // score" only opens it.
      const scored = scoreRun(next.run.picks, five);
      next = finishDay(next, { date: today.date, ...scored, ms: clockNow() - next.run.startedAt, ...(userId ? { by: userId } : {}) });
    }
    writeStore(next);
    setRecord(next);
    setNow(clockNow());
    setPicked(optionIndex);
  }

  function forward(event) {
    if (index + 1 >= DAILY_FIVE_SIZE) {
      focusNext.current = 'result';
      setOpenRow(null);
      setJustFinished(true);
      setPhase('result');
      return;
    }
    focusNext.current = event.detail === 0 ? 'options' : 'card';
    setIndex((i) => i + 1);
    setPicked(null);
  }

  async function shareScore() {
    if (!result) return;
    const text = shareText(result);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // the student closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShare('copied');
      window.setTimeout(() => setShare('idle'), 2400);
    } catch {
      setShare('failed');
    }
  }

  const over = (
    <div className="dly__head">
      <p className="dly__over">{today ? <>{dayLabel(today.date)}<span aria-hidden="true"> · </span><span className="sr-only">, </span>No. {today.day}</> : ' '}</p>
      <h1 className="lp-h2 dly__title">Daily Five</h1>
      <p className="lp-sub dly__lead">The same five CUET questions for everyone today. One go a day, no sign-up.</p>
    </div>
  );

  // ---------- Result: just finished, or played earlier today (here or, signed in, on another phone) ----------
  if (showResult) {
    // Signed in: the run is the account's (with today while its save is on the way); a guest's is this device's.
    const saveState = !signedIn ? 'guest' : accountRecord || result.saved || saving === 'saved' ? 'saved'
      : saving === 'failed' || account?.state === 'failed' ? 'failed' : saving === 'device' ? 'device' : 'saving';
    const days = signedIn && accountReady ? runDays(account.played, today.date, true) : record.played;
    const streak = streakOf(days, today.date);
    const line = streakLine(streak);
    const wait = untilWords(msUntilNextDay(now));
    const missedAt = new Map(result.missed.map((m) => [m.n, m]));
    const chapters = result.chapters || (five ? five.map((q) => q.chapter) : null);
    const rows = result.marks.map((right, i) => {
      const n = i + 1;
      const miss = missedAt.get(n) || null;
      const q = five?.[i] || null;
      // A right answer opens to its question and reason when the page holds the five; a miss always opens.
      const body = miss || (right && q ? { n, chapter: q.chapter, q: q.q, picked: q.options[q.correct], answer: null, why: q.why } : null);
      return { n, right, chapter: chapters?.[i] || miss?.chapter || `Question ${n}`, body, crowd: crowdLineFor(crowd, five, i) };
    });
    return (
      <>
        {over}
        <div className="lp-desk dly__desk">
          <div className="lp-desk__card">
            <div className="lp-card mm-drill" aria-live="polite" role="group" aria-label="Today’s Daily Five result">
              <div className="lp-card__head">
                <span className="lp-card__sub"><b>{justFinished ? 'Your score' : 'Today’s five: done'}</b><span>{shortDate(result.date)}</span></span>
              </div>
              <div className="lp-card__body mm-drill__result" ref={resultRef} tabIndex={-1} aria-label={`Your score: ${result.score} out of 5, in ${clockWords(result.ms)}.`}>
                <div className="dly__score-row">
                  <p className="mm-drill__score">{result.score}<span>/5</span></p>
                  <p className="dly__time"><Icon name="clock" className="dly__time-icon" /><span className="sr-only">Time </span>{formatClock(result.ms)}</p>
                </div>
                <Squares marks={result.marks} label={squaresLabel(result.marks)} />
                <p className="dly__next">Come back tomorrow for a new five. It opens in {wait}.</p>

                <div className="dly__share">
                  <button type="button" className="mm-btn mm-btn--primary" onClick={shareScore} data-state={share}>
                    {share === 'copied' ? <><Icon name="check" className="dly__share-icon" />Copied</> : 'Share your score'}
                  </button>
                  <p className="dly__share-note" aria-live="polite">
                    {share === 'copied' ? 'Your score is copied. Paste it in WhatsApp.' : share === 'failed' ? 'Couldn’t copy. Press and hold the lines below to copy them.' : 'Your score and squares only. No questions.'}
                  </p>
                  {share === 'failed' ? <p className="dly__share-text">{shareText(result)}</p> : null}
                </div>

                {line || signedIn ? (
                  <div className="dly__streak">
                    {line ? <p className="dly__streak-line">{line.head}</p> : null}
                    <p className="dly__streak-note" aria-live="polite">{line?.more ? `${line.more} ` : ''}{runNote(saveState)}</p>
                    {saveState === 'failed' ? <button type="button" className="dly__again" onClick={retrySave}>Try again</button> : null}
                  </div>
                ) : null}

                <div className="mm-drill__readout dly__list">
                  <p className="mm-drill__readout-head">{result.score === DAILY_FIVE_SIZE ? 'All five right today.' : 'Question by question'}</p>
                  <ul>
                    {rows.map((row) => {
                      const open = openRow === row.n;
                      const panelId = `${leadId}-q-${row.n}`;
                      const head = (
                        <>
                          <span className="mm-drill__miss-n">Q{row.n}</span>{' '}
                          <span className="mm-drill__miss-chapter">
                            {row.chapter}
                            {row.crowd ? <span className="dly__crowd">{row.crowd}</span> : null}
                          </span>
                          <span className="dly__mark" data-right={row.right ? 'true' : 'false'} aria-hidden="true" />
                          <span className="sr-only">{row.right ? ', right' : ', missed'}</span>
                          {row.body ? <Icon name="chevR" className="mm-drill__miss-chev" /> : <span className="dly__chev-space" aria-hidden="true" />}
                        </>
                      );
                      return (
                        <li key={row.n} className="mm-drill__miss" data-open={open ? 'true' : 'false'} data-right={row.right ? 'true' : 'false'}>
                          {row.body ? (
                            <button type="button" className="mm-drill__miss-row" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenRow(open ? null : row.n)}>{head}</button>
                          ) : (
                            <div className="mm-drill__miss-row dly__row-still">{head}</div>
                          )}
                          {row.body ? (
                            <div className="mm-drill__miss-fold" id={panelId} inert={!open}>
                              <div className="mm-drill__miss-body">
                                <p className="mm-drill__miss-q">{row.body.q}</p>
                                <dl className="mm-drill__miss-answers">
                                  {row.right ? (
                                    <div className="mm-drill__miss-answer" data-kind="correct">
                                      <dt><Icon name="check" className="mm-drill__miss-mark" />Your answer</dt>
                                      <dd>{row.body.picked}</dd>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="mm-drill__miss-answer" data-kind="yours">
                                        <dt><Icon name="x" className="mm-drill__miss-mark" />Your answer</dt>
                                        <dd>{row.body.picked}</dd>
                                      </div>
                                      <div className="mm-drill__miss-answer" data-kind="correct">
                                        <dt><Icon name="check" className="mm-drill__miss-mark" />Correct answer</dt>
                                        <dd>{row.body.answer}</dd>
                                      </div>
                                    </>
                                  )}
                                </dl>
                                <p className="mm-drill__miss-why dly__miss-why">{row.body.why}</p>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* One quiet key on: a guest keeps their papers by signing up; a signed-in student starts a set in Practice. */}
                <div className="dly__on">
                  {status === 'loading' ? null : isAuthenticated
                    ? <Link href={firstSetHref()} className="mm-drill__replay">{FIRST_SET_LABEL}</Link>
                    : <Link href="/signup" className="mm-drill__replay">Sign up free to keep your papers</Link>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ---------- Loading and failed ----------
  // Signed in, the start waits for the account: a five finished on another phone shows as played, never as Start.
  const waiting = !result && phase !== 'playing' && phase !== 'failed' && (!authKnown || (signedIn && (!account || account.state === 'loading')));
  if (phase === 'loading' || phase === 'failed' || !five || waiting) {
    const failed = phase === 'failed';
    return (
      <>
        {over}
        <div className="lp-desk dly__desk">
          <div className="lp-desk__card">
            <div className="lp-card mm-drill" role="group" aria-label="Today’s Daily Five" aria-busy={failed ? undefined : 'true'}>
              <div className="lp-card__head">
                <span className="lp-card__sub"><b>Today’s five</b></span>
              </div>
              <div className="lp-card__body">
                <p className="mm-drill__pick-lead" aria-live="polite" data-tone={failed ? 'error' : null}>
                  {failed
                    ? failure === 'offline'
                      ? 'You’re offline. Reconnect, then try again.'
                      : failure === 'slow'
                        ? 'Today’s five are taking too long to load.'
                        : 'Couldn’t load today’s five just now.'
                    : 'Loading today’s five.'}
                </p>
                {failed ? (
                  <div className="dly__retry">
                    <button type="button" className="mm-btn mm-btn--primary" onClick={load}>Try again</button>
                  </div>
                ) : (
                  <div className="mm-drill__loading" aria-hidden="true">
                    <div className="mm-drill__loading-paper">
                      <div className="mm-drill__loading-stem"><i /><i /></div>
                      <div className="mm-drill__options">
                        {KEYS.map((letter) => (
                          <div className="mm-drill__option mm-drill__loading-option" key={letter}>
                            <span className="mm-drill__key">{letter}</span><i />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ---------- Start ----------
  if (phase !== 'playing' || !run) {
    const days = signedIn && accountReady ? account.played : record ? record.played : [];
    const streak = today ? streakOf(days, today.date) : { count: 0 };
    return (
      <>
        {over}
        <div className="lp-desk dly__desk">
          <div className="lp-desk__card">
            <div className="lp-card mm-drill" role="group" aria-label="Today’s Daily Five" tabIndex={-1} ref={rootRef}>
              <div className="lp-card__head">
                <span className="lp-card__sub"><b>Today’s five</b><span>{mixLine(five)}</span></span>
              </div>
              <div className="lp-card__body">
                <p className="mm-drill__q dly__start-q">Five questions, one at a time, each with its answer explained.</p>
                <ul className="dly__rules">
                  <li>The clock starts when you press Start.</li>
                  <li>One go a day. An answer can’t be changed.</li>
                  {signedIn ? <li>Your score is saved to your account and counts as a study day.</li> : null}
                  {streak.count > 0 ? <li>{streak.count === 1 ? 'You played yesterday.' : `You’ve played ${streak.count} days in a row.`} Play today to keep it going.</li> : null}
                </ul>
                <div className="dly__go">
                  <button type="button" className="mm-btn mm-btn--primary" onClick={start}>Start today’s five</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ---------- Playing ----------
  const question = five[index];
  const answered = picked !== null;
  // Once the fifth answer is in, the day is finished: the clock and the dashes read from the result.
  const shownMs = result ? result.ms : run ? Math.max(0, now - run.startedAt) : 0;
  const marks = result ? result.marks : run ? run.picks.map((p, i) => (Number.isInteger(p) ? p === five[i].correct : null)) : [];
  return (
    <>
      {over}
      <div className="dly__clock-row">
        <p className="dly__clock" role="timer" aria-label={`Time ${clockWords(shownMs)}`}>
          <Icon name="clock" className="dly__time-icon" />
          <span aria-hidden="true">{formatClock(shownMs)}</span>
        </p>
      </div>
      <div className="lp-desk dly__desk">
        <div className="lp-desk__card">
          <div className="lp-card mm-drill" data-answered={index + (answered ? 1 : 0)} data-mode="drill" tabIndex={-1} role="group" aria-label="Today’s Daily Five" ref={rootRef}>
            <div className="lp-card__head">
              <span className="lp-card__sub"><b>{question.subject}</b><span>{index + 1} of {DAILY_FIVE_SIZE}</span></span>
              <span className="mm-drill__progress" aria-hidden="true">
                {five.map((item, i) => (
                  <span
                    key={i}
                    className="mm-drill__pip"
                    data-state={i < index ? 'past' : i === index ? 'now' : 'next'}
                    data-result={marks[i] === true ? 'right' : marks[i] === false ? 'wrong' : undefined}
                  />
                ))}
              </span>
            </div>

            <div className="lp-card__body" data-seq={index > 0 ? 'true' : null}>
              <p key={index} className="mm-drill__q" data-long={question.q.length > LONG_STEM ? 'true' : undefined}>{question.q}</p>
              {question.pastPaper ? <p className="mm-drill__past-paper">{question.pastPaper}</p> : null}

              <div className="mm-drill__options" role="group" aria-label="Answer options" ref={optionsRef}>
                {question.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === question.correct;
                  const isPicked = picked === optionIndex;
                  let state = 'idle';
                  if (answered && isCorrect) state = 'correct';
                  else if (isPicked) state = 'wrong';
                  else if (answered) state = 'muted';
                  return (
                    <button key={`${index}-${optionIndex}`} type="button" className="mm-drill__option" data-state={state} onClick={(event) => pick(optionIndex, event)} disabled={answered}>
                      <span className="mm-drill__key" aria-hidden="true">{KEYS[optionIndex]}</span>
                      <span className="mm-drill__label">{option}</span>
                      {answered && isCorrect ? <Icon name="check" className="mm-drill__verdict-icon" /> : null}
                      {answered && isPicked && !isCorrect ? <Icon name="x" className="mm-drill__verdict-icon" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="mm-drill__reveal" data-open={answered ? 'true' : 'false'}>
                <div className="mm-drill__foot" aria-live="polite" ref={footRef}>
                  {answered ? (
                    <>
                      <p className="mm-drill__why" data-verdict={picked === question.correct ? 'right' : 'wrong'}>
                        <span>
                          <strong data-ok={picked === question.correct ? 'true' : 'false'}>{picked === question.correct ? 'Correct.' : 'Not quite.'}</strong>{' '}
                          {question.why}
                        </span>
                      </p>
                      <button type="button" className="mm-btn mm-btn--primary" onClick={forward}>
                        {index + 1 >= DAILY_FIVE_SIZE ? 'See my score' : 'Next question'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
