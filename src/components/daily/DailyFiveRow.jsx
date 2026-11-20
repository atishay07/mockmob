"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useOnScreen } from './DailyParts';
import { CollegeBoard, CollegeSheet, OmrFive, PlayingFor, useBoard, useTeamChoice } from './DailyTeam';
import { COLLEGE_DAILY, SUNDAY_LINE_SHORT, dailyRow, omrLabel, sundayRow } from './dailyStripCopy.mjs';
import './daily-row.css';

// The doors to the Daily Five.
//   where="home"   the home page's block, low on the page under the exam screen. 17 Nov 2026 (owner LK293: the look was
//                  understood, but the ink "Open now" band and the date slab read as Prepium's; build "something unique"
//                  around the team idea). One admit card for the Daily Five, in the exam's own materials: the five's name and
//                  today's edition ("Tuesday's five, 17 Nov", never a bare number), the state and its time, "Playing for" (the
//                  DU college this device plays for, picked in a sheet: CollegeSheet), the five as answer bubbles (this
//                  device's record: open, the one being answered, right or missed), three figures and the one volt key; then,
//                  past a perforation, today's college board (the first three colleges and the student's own). The Sunday
//                  Mock's card follows. The words are dailyStripCopy.mjs's. The block carries one volt key: the Sunday Mock's
//                  while its paper is open, else the Daily Five's. Nothing here moves by itself.
//   where="today"  on Today for a signed-in student, under the lead card's rows, drawn as Today's Ask Mobi row (today.css
//                  .tmask). It reads the account (GET /api/daily/me): today's score, the run of days and the college are the
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
      <article className="dwk-ticket" data-personal={!COLLEGE_DAILY || undefined} data-state={daily.state} aria-labelledby="dwk-daily">
        <div className="dwk-ticket__play">
          <div className="dwk-ticket__head">
            <h3 className="dwk-name" id="dwk-daily">Daily Five</h3>
            <p className="dwk-edition">{today ? editionName(today.date) : ' '}</p>
            <p className="dwk-state">
              <StateMark mark={daily.state === 'played' ? 'done' : today ? 'open' : 'none'} />
              <span className="dwk-status">{daily.status || ' '}</span>
              <span className="dwk-when">{daily.when}</span>
            </p>
          </div>
          {COLLEGE_DAILY ? <PlayingFor team={team} onOpen={() => setSheet(true)} /> : null}
          {/* The bubbles carry this device's state: shown once a question is answered (open, they would only repeat the 5). */}
          {marks ? <OmrFive marks={marks} current={current} label={omrLabel(marks, current)} /> : null}
          <ul className="dwk-figs">
            {daily.figures.map((f) => <li key={f.figure + f.unit}><b>{f.figure}</b>{f.unit ? <span>{f.unit}</span> : null}</li>)}
          </ul>
          <Link href={daily.href} prefetch={false} className="dwk-key" data-lead={!sunday.open ? 'true' : 'false'}>{daily.go}</Link>
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
  useEffect(() => {
    if (!date) return undefined;
    let alive = true;
    fetch(DAILY_FIVE_ME_ROUTE, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { const acc = acceptAccount(body); if (alive && acc && acc.date === date) setAccount(acc); })
      .catch(() => {});
    return () => { alive = false; };
  }, [date]);
  const { isAuthenticated, user } = useAuth();
  const team = useTeamChoice({ today: date, account: account?.team || null, userId: isAuthenticated && user?.id ? String(user.id) : null });

  const ready = Boolean(today && record);
  const fromAccount = ready && account && account.date === today.date;
  const result = !ready ? null : fromAccount ? account.record : resultFor(record, today.date, null);
  const streak = !ready ? 0 : fromAccount
    ? streakOf(runDays(account.played, today.date, Boolean(result)), today.date).count
    : streakOf(record.played, today.date).count;
  const wait = now === null ? '' : untilShort(msUntilNextDay(now));
  const college = COLLEGE_DAILY && team.college ? teamName(team.college) : '';
  // A played five names the college it counted for: the account's for today (its rows say so), never this device's choice,
  // which may already be the next day's.
  const counted = COLLEGE_DAILY && fromAccount && account.team && account.team.last === today.date ? teamName(account.team.college) : '';
  const line = !ready ? ' ' : result
    ? `Played today: ${result.score}/5 in ${formatClock(result.ms)}${counted ? ` for ${counted}` : ''}.${streak >= 2 ? ` Day ${streak} in a row.` : ''} Next five in ${wait}.`
    : `${streak >= 2 ? `${streak} days in a row so far.` : streak === 1 ? 'You played yesterday.' : college ? `Playing for ${college}.` : 'Five questions, the same for everyone.'} Today’s five closes in ${wait}.`;
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
