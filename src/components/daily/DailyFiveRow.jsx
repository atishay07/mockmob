"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import {
  DAILY_FIVE_PATH, DAILY_FIVE_STORE, formatClock, msUntilNextDay, nextIndex, readRecord, resultFor, streakOf, todayDaily, untilShort,
} from '@/lib/dailyFive.mjs';
import { DAILY_FIVE_ME_ROUTE, acceptAccount, runDays } from '@/lib/dailyFiveAccount.mjs';
import { editionName } from '@/lib/daily/team.mjs';
import { teamName } from '@/lib/daily/colleges.mjs';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';
import { DAILY_MINE_ROUTE, acceptMine } from '@/lib/dailyFiveMine.mjs';
import CursorDemo from '@/components/landing/demo/CursorDemo';
import { useOnScreen } from './DailyParts';
import { CollegeBoard, CollegeSheet, OmrFive, PlayingFor, useBoard, useTeamChoice } from './DailyTeam';
import DailyStory from './DailyStory.jsx';
import { DAILY_SAY, DAILY_STORY, STORY_WORDS } from './dailyStoryScript.mjs';
import { COLLEGE_DAILY, DAILY_PRINT, SUNDAY_LINE_SHORT, dailyRow, omrLabel, sundayRow, todayDoneLine, todayMineLine } from './dailyStripCopy.mjs';
import { DAILY_MINE_STORE, didLines, readMark } from './dailyMineUi.mjs';
import './daily-row.css';

// The doors to the Daily Five.
//   where="home"   the home page's block, low on the page under the exam screen. 22 Nov 2026 (owner LK366: "This daily 5: I'm
//                  unable to understand"): the Daily Five's card is ONE surface: "Daily Five" with the "Example" mark, the
//                  beat's line, the demo screen drawn flat, then today's facts in one quiet line (TodayLine), the key and the
//                  small print. The demo starts only once its line and screen are wholly in the window. 21 Nov 2026 (owner LK365: "this Daily 5
//                  feature has to be completely rethought"; tmp/1121-stories/DAILY-SPEC.md "Your five"): the Daily Five's card
//                  is a small demo that plays by itself (DailyDemo: DailyStory worked by the landing's demo cursor, the beat's
//                  line above it), then the key and the small print. The Sunday Mock's card is unchanged. Before that: 17 Nov 2026 (owner LK293: the look was
//                  understood, but the ink "Open now" band and the date slab read as Prepium's; build "something unique"
//                  around the team idea). One admit card for the Daily Five, in the exam's own materials: the five's name and
//                  today's edition ("Tuesday's five, 17 Nov", never a bare number), the state and its time, "Playing for" (the
//                  DU college this device plays for, picked in a sheet: CollegeSheet), the five as answer bubbles (this
//                  device's record: open, the one being answered, right or missed), three figures and the one volt key; then,
//                  past a perforation, today's college board (the first three colleges and the student's own). The Sunday
//                  Mock's card follows. The words are dailyStripCopy.mjs's. The block carries one volt key: the Sunday Mock's
//                  while its paper is open, else the Daily Five's. Nothing here moves by itself.
//   where="today"  on Today for a signed-in student, under the lead card's rows, drawn as Today's Ask Mobi row (today.css
//                  .tmask). While today is not played, it shows the student's own five's mix (GET /api/daily/mine) when the
//                  route built one, else the shared five's line. It reads the account (GET /api/daily/me): today's score, the run of days and the college are the
//                  account's, so a five played on another phone shows here too; while the account has not answered (or
//                  cannot), the device's record stands in.
// The first paint has no date and no record (the server has neither): every part holds its size and fills in once.

const readDevice = () => {
  let record = null;
  try { record = readRecord(window.localStorage.getItem(DAILY_FIVE_STORE)); } catch { record = readRecord(null); }
  return record;
};

/** This device's record, read after the first paint and again when the tab or the page comes back (a five just played). */
function useDeviceRecord() {
  const [record, setRecord] = useState(null);
  const read = useCallback(() => setRecord(readDevice()), []);
  useEffect(() => {
    const t = window.setTimeout(read, 0);
    const back = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('pageshow', read);
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', back); window.removeEventListener('pageshow', read); };
  }, [read]);
  return record;
}

/** Five small squares: hollow until today is played, then the day's own row (filled for right). */
function Mark({ marks }) {
  return (
    <span className="dfr__mark" aria-hidden="true">
      {(marks || [false, false, false, false, false]).map((right, i) => <i key={i} data-right={marks && right ? 'true' : 'false'} />)}
    </span>
  );
}

/** The clock, read once after the first paint and then twice a minute while the strip is near the screen. */
function useMinuteNow(active) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    const back = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', back);
    return () => { window.clearTimeout(t); window.clearInterval(id); document.removeEventListener('visibilitychange', back); };
  }, [active]);
  return now;
}

/** The state's still mark: a volt square while open, a check once done, the calendar's clock while it waits. Never a dot. */
function StateMark({ mark }) {
  return (
    <i className="dwk-mark" data-mark={mark} aria-hidden="true">
      {mark === 'done' ? <Icon name="check" /> : mark === 'soon' ? <CalendarClock size={16} strokeWidth={2} /> : null}
    </i>
  );
}

const reducedNow = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced');

// The site bar's height on the home page (HeroDockGate NAV): the demo starts only once its line and its screen are both
// wholly below it.
const SITE_BAR_PX = 64;
// "Wholly inside the window": a ratio this close to 1 (at most about 4 px of the screen lost to rounding still counts as whole).
const WHOLE = 0.99;

/**
 * The Daily Five's demo: the beat's line with its step dots, then DailyStory worked by the demo cursor (owner LK366, 22 Nov
 * 2026: "This daily 5: I'm unable to understand"). It plays once each time its line AND its screen are wholly inside the
 * window below the site bar (an IntersectionObserver on both, the way the one-place frame waits for its room), so nothing
 * happens where the reader cannot see it; it stops and resets when the screen leaves mid-way. A real tap inside it takes
 * over (CursorDemo): from then on it is the reader's, and it never plays by itself again on this visit. When it ends it
 * rests on the day's end with the fourth line kept, and a quiet "Watch again". Before it plays, the line is the first beat's.
 * Reduced motion: no cursor, no script; the four lines listed, the day's end shown, still usable by hand.
 */
function DailyDemo() {
  const sayRef = useRef(null);
  const stageRef = useRef(null);
  const [run, setRun] = useState(0);
  const [mode, setMode] = useState('idle'); // idle | playing | done | taken
  const [line, setLine] = useState({ text: DAILY_SAY[0], beat: 0 });
  // null until read after the first paint (the server cannot know): then true or false.
  const [reduced, setReduced] = useState(null);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => {
    const t = window.setTimeout(() => setReduced(reducedNow()), 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const say = sayRef.current;
    const el = stageRef.current;
    if (!say || !el || reduced !== false || typeof IntersectionObserver !== 'function') return undefined;
    let armed = true; // may play on the next entry
    const ratio = new Map([[say, 0], [el, 0]]);
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) ratio.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      const m = modeRef.current;
      if (ratio.get(say) >= WHOLE && ratio.get(el) >= WHOLE) {
        if (armed && m !== 'taken') {
          armed = false;
          setLine({ text: DAILY_SAY[0], beat: 0 });
          if (m !== 'idle') setRun((n) => n + 1);
          setMode('playing');
        }
      } else if (ratio.get(el) < 0.2) {
        if (m === 'playing') { setMode('idle'); setRun((n) => n + 1); setLine({ text: DAILY_SAY[0], beat: 0 }); }
        if (m !== 'taken') armed = true;
      }
    }, { rootMargin: `-${SITE_BAR_PX}px 0px 0px 0px`, threshold: [0, 0.2, 0.5, WHOLE, 1] });
    io.observe(say);
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);
  const onSay = useCallback((text, beat) => setLine({ text, beat }), []);
  const onDone = useCallback(() => setMode('done'), []);
  const onTakeover = useCallback(() => setMode('taken'), []);
  const again = () => { setLine({ text: DAILY_SAY[0], beat: 0 }); setRun((n) => n + 1); setMode('playing'); };
  const beats = DAILY_SAY.length;
  // The screen as one kept element: a new beat's line re-renders this block, never the screen (on a slow phone each needless
  // re-render of it stretched the script).
  const story = useMemo(() => <DailyStory rest={reduced === true} />, [reduced]);
  // The rows wait out of sight until the demo plays (they then arrive one by one); only once the page knows it will play.
  const waiting = reduced === false && mode === 'idle';
  return (
    <div className="dst-demo" data-mode={reduced ? 'still' : mode} data-wait={waiting || undefined}>
      <div className="dst-say" ref={sayRef}>
        {reduced ? (
          // Reduced motion: the four beats as a still list, beside the day's end.
          <ol className="dst-say__all">{DAILY_SAY.map((text) => <li key={text}>{text}</li>)}</ol>
        ) : (
          <>
            <p className="dst-say__where">
              <span className="dst-say__dots" aria-hidden="true">{Array.from({ length: beats }, (_, i) => <i key={i} data-on={i === line.beat || undefined} data-done={i < line.beat || undefined} />)}</span>
              <span aria-hidden="true">{`Step ${line.beat + 1} of ${beats}`}</span>
              {mode === 'done' || mode === 'taken' ? <button type="button" className="dst-say__again" onClick={again}>Watch again</button> : null}
            </p>
            <p className="dst-say__line" aria-hidden="true"><span key={`${run}-${line.beat}`} className="dst-say__text">{line.text}</span></p>
            {/* A screen reader gets the four lines at once, not one every few seconds. */}
            <ol className="sr-only">{DAILY_SAY.map((text) => <li key={text}>{text}</li>)}</ol>
          </>
        )}
      </div>
      <div className="dwk-story__stage" ref={stageRef}>
        <CursorDemo key={run} steps={DAILY_STORY.steps} playing={mode === 'playing'} onSay={onSay} onDone={onDone} onTakeover={onTakeover} className="dst-stage">
          {story}
        </CursorDemo>
      </div>
    </div>
  );
}

/** Today's facts in one quiet line beside the key: the edition, the state and its time (dailyRow's own words). */
function TodayLine({ today, daily }) {
  return (
    <p className="dwk-today">
      <StateMark mark={daily.state === 'played' ? 'done' : today ? 'open' : 'none'} />
      <span className="dwk-today__text">
        {today ? <span className="dwk-today__ed">{editionName(today.date)}.</span> : null}
        {daily.status ? <>{' '}<b className="dwk-status">{daily.status}{daily.when ? ',' : '.'}</b></> : null}
        {daily.when ? <>{' '}<span className="dwk-when">{daily.when}.</span></> : null}
      </span>
    </p>
  );
}

function HomeBlock() {
  const ref = useRef(null);
  const record = useDeviceRecord();
  // 1,600 px ahead (about four swipes): the clock, the student's college and the board all settle before the block is seen, so
  // the board's answer (often one short sentence where the still rows stood) never moves the Sunday card under a reader's eyes
  // (a 0.125 layout shift was measured on production on 17 Nov when the answer came late).
  const on = useOnScreen(ref, '1600px 0px');
  const now = useMinuteNow(on);
  const today = now === null ? null : todayDaily(now);
  const ready = Boolean(today && record);
  const result = ready ? resultFor(record, today.date, null) : null;
  const run = ready && !result && record.run && record.run.date === today.date ? record.run : null;
  const begun = Boolean(run && run.picks.some((p) => p !== null));
  const streak = ready ? streakOf(record.played, today.date).count : 0;
  const daily = dailyRow({
    result: result ? { score: result.score, clock: formatClock(result.ms) } : null,
    begun, at: begun ? nextIndex(run.picks) + 1 : null, streak, waitMs: now === null ? null : msUntilNextDay(now),
  });
  const sunday = sundayRow({ now });
  const team = useTeamChoice({ today: today?.date || null });
  const board = useBoard(today?.date || null, on && COLLEGE_DAILY);
  const [sheet, setSheet] = useState(false);
  const marks = result ? result.marks : run ? run.checks.map((c) => (c ? c.right : null)) : null;
  const current = begun && !result ? nextIndex(run.picks) : null;
  // One volt key in the block: the Sunday Mock's while a paper can be started (12 hours a week), else the Daily Five's.
  return (
    <div className="dwk" ref={ref}>
      <article className="dwk-ticket" data-story="" data-board={COLLEGE_DAILY || undefined} data-state={daily.state} aria-labelledby="dwk-daily">
        <div className="dwk-ticket__play">
          {/* One surface (owner LK366, 22 Nov 2026: the card in a card read as five layers of words): its head row, the
              beat's line, the demo screen drawn flat on the card, then today's facts in one quiet line beside the key. */}
          <div className="dwk-ticket__head">
            <h3 className="dwk-name" id="dwk-daily">Daily Five</h3>
            <span className="dwk-example">{STORY_WORDS.example}</span>
          </div>
          <DailyDemo />
          <div className="dwk-story__foot">
            {COLLEGE_DAILY ? <PlayingFor team={team} onOpen={() => setSheet(true)} /> : null}
            {/* The bubbles carry this device's state: shown once a question is answered (open, they would only repeat the 5). */}
            {marks ? <OmrFive marks={marks} current={current} label={omrLabel(marks, current)} /> : null}
            {/* The card's three figures (dailyRow figures: 5 questions, Free, No sign-up) are said by the head's line (five a
                day) and the small print (free, no account needed), so the card does not say them a third time. */}
            <TodayLine today={today} daily={daily} />
            <Link href={daily.href} prefetch={false} className="dwk-key" data-lead={!sunday.open ? 'true' : 'false'}>{daily.go}</Link>
            <p className="dwk-story__print">{DAILY_PRINT}</p>
          </div>
        </div>
        {COLLEGE_DAILY ? <div className="dwk-ticket__board">
          <CollegeBoard
            load={board}
            mine={team.college}
            mode="preview"
            title="College board"
            aside={<Link href={`${DAILY_FIVE_PATH}#board`} prefetch={false} className="dwk-more" aria-label="See all of the college board">See all<ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" /></Link>}
          />
        </div> : null}
      </article>
      <article className="dwk-card" data-kind="sunday" data-state={sunday.phase} aria-labelledby="dwk-sunday">
        <div className="dwk-card__head">
          <h3 className="dwk-name" id="dwk-sunday">Sunday Mock</h3>
          <p className="dwk-state">
            <StateMark mark={sunday.open ? 'open' : sunday.phase === 'unknown' ? 'none' : 'soon'} />
            <span className="dwk-status">{sunday.status || ' '}</span>
            <span className="dwk-when">{sunday.when}</span>
          </p>
        </div>
        <p className="dwk-line">{SUNDAY_LINE_SHORT}</p>
        <ul className="dwk-figs">
          {sunday.figures.map((f) => <li key={f.figure + f.unit}><b>{f.figure}</b>{f.unit ? <span>{f.unit}</span> : null}</li>)}
        </ul>
        <Link href={sunday.href} prefetch={false} className="dwk-key" data-lead={sunday.open ? 'true' : 'false'}>{sunday.go}</Link>
      </article>
      <CollegeSheet open={sheet} onClose={() => setSheet(false)} onChoose={(id) => { team.pick(id); setSheet(false); }} current={team.college} />
    </div>
  );
}

function TodayRow() {
  const record = useDeviceRecord();
  const [account, setAccount] = useState(null);
  const [now, setNow] = useState(null);
  useEffect(() => {
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => { window.clearTimeout(t); window.clearInterval(id); };
  }, []);
  const today = now === null ? null : todayDaily(now);
  const date = today?.date || null;
  // The account's day (GET /api/daily/me), then, while today is not played, the student's own five (GET /api/daily/mine,
  // "Your five", 21 Nov 2026): its mix is the row's line. One read each, after the account answers; any failure, a 401, a
  // 429 or `personal: false` leaves the shared five's line (`mine` 'shared').
  const [meDone, setMeDone] = useState(false);
  useEffect(() => {
    if (!date) return undefined;
    let alive = true;
    fetch(DAILY_FIVE_ME_ROUTE, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { const acc = acceptAccount(body); if (alive && acc && acc.date === date) setAccount(acc); })
      .catch(() => {})
      .finally(() => { if (alive) setMeDone(true); });
    return () => { alive = false; };
  }, [date]);
  const [mine, setMine] = useState(null); // null while unknown, 'shared', or the personal five ({ date, mix })
  const { isAuthenticated, user } = useAuth();
  const userId = isAuthenticated && user?.id ? String(user.id) : null;
  const team = useTeamChoice({ today: date, account: account?.team || null, userId });
  // This device's note of today's personal five (dailyMineUi.mjs): whether today's five was the student's own, and what each
  // answer fed. Read once the account has answered (the note is written as the five is played, here or on /daily).
  const [note, setNote] = useState(null);
  useEffect(() => {
    if (!meDone || !date || !userId) return undefined;
    const t = window.setTimeout(() => {
      try { setNote(readMark(window.localStorage.getItem(DAILY_MINE_STORE), { date, userId })); } catch { setNote(null); }
    }, 0);
    return () => window.clearTimeout(t);
  }, [meDone, date, userId]);

  const ready = Boolean(today && record);
  const fromAccount = ready && account && account.date === today.date;
  const result = !ready ? null : fromAccount ? account.record : resultFor(record, today.date, null);
  const askMine = Boolean(ready && meDone && !result);
  useEffect(() => {
    if (!askMine || !date) return undefined;
    let alive = true;
    fetch(DAILY_MINE_ROUTE, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!alive) return;
        const got = acceptMine(body);
        setMine(got && got.personal && got.date === date ? { date: got.date, mix: got.mix } : 'shared');
      })
      .catch(() => { if (alive) setMine('shared'); });
    return () => { alive = false; };
  }, [askMine, date]);
  const own = mine && mine !== 'shared' && today && mine.date === today.date ? mine : null;
  const streak = !ready ? 0 : fromAccount
    ? streakOf(runDays(account.played, today.date, Boolean(result)), today.date).count
    : streakOf(record.played, today.date).count;
  const wait = now === null ? '' : untilShort(msUntilNextDay(now));
  const college = COLLEGE_DAILY && team.college ? teamName(team.college) : '';
  // A played five names the college it counted for: the account's for today (its rows say so), never this device's choice,
  // which may already be the next day's.
  const counted = COLLEGE_DAILY && fromAccount && account.team && account.team.last === today.date ? teamName(account.team.college) : '';
  // A personal five (21 Nov 2026 critic): before it is played, the mix and the time left; once played, the score and what the
  // five did. Both fit the row's two lines, so it never grows when the answer comes.
  const line = !ready ? ' ' : result && note?.personal
    ? todayDoneLine({ score: result.score, did: didLines(note).lines, wait })
    : result
    ? `Played today: ${result.score}/5 in ${formatClock(result.ms)}${counted ? ` for ${counted}` : ''}.${streak >= 2 ? ` Day ${streak} in a row.` : ''} Next five in ${wait}.`
    : own ? todayMineLine({ mix: own.mix, wait })
    // Until the student's own five is known, nothing is said about whose five it is: "the same for everyone" is true only once
    // the route says this student plays the shared five.
    : `${streak >= 2 ? `${streak} days in a row so far. ` : streak === 1 ? 'You played yesterday. ' : college ? `Playing for ${college}. ` : mine === 'shared' ? 'The same five for everyone. ' : ''}Today’s five closes in ${wait}.`;
  return (
    <Link href={DAILY_FIVE_PATH} className="tmask dfr dfr--today" data-played={result ? 'true' : 'false'}>
      <Mark marks={result?.marks} />
      <span className="tmask__text"><b>Daily Five</b><span>{line}</span></span>
      <ChevronRight className="tmask__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

export default function DailyFiveRow({ where = 'home' }) {
  return where === 'today' ? <TodayRow /> : <HomeBlock />;
}
