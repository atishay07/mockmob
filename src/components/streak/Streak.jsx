"use client";
// The daily streak's pieces (17 Nov 2026, LK296): the week view (S5), the rest-pass slots (S3), the milestone path (S6), the
// exam pause picker (S8) and the streak sheet that holds them, opened from the top bar chip, Today, You and You > Goal. Every
// number is the server's (GET /api/me/streak); the words are streakCopy.mjs. Nothing pulses or counts down: marks draw once when
// the sheet opens (160 ms ease-out), and reduced motion shows them still.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Moon, X } from 'lucide-react';
import {
  PAUSE_TITLE, makeUpRule, passRule, STREAK_NAME, daysWord, milestoneLine, passLine, pauseKey, pauseLine, pauseSetLine, ruleLine, statusLine,
  streakWeek, weekLegend, weekdayOf,
} from '@/lib/streak/streakCopy.mjs';
import { closeStreakSheet, sendPause, useStreak, useStreakSheet } from './useStreak';
import './streak.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** One OMR bubble for a day. */
export function DayMark({ look, size = 'md' }) {
  return (
    <span className="stk-bubble" data-look={look} data-size={size} aria-hidden="true">
      {look === 'done' || look === 'made_up' ? <Check size={size === 'sm' ? 12 : 15} strokeWidth={3} /> : null}
      {look === 'rested' ? <Moon size={size === 'sm' ? 11 : 13} strokeWidth={2.4} /> : null}
      {look === 'paused' ? <i className="stk-bubble__bar" /> : null}
    </span>
  );
}

/** The last 7 days (S5): done, rested, made up, paused, open, today, or a plain day. Never a cross. */
export function StreakWeek({ body }) {
  const marks = useMemo(() => streakWeek(body), [body]);
  const legend = weekLegend(marks);
  return (
    <div className="stk-week">
      <ol className="stk-week__row" aria-label="Your last 7 days">
        {marks.map((m, i) => (
          <li key={m.day} className="stk-week__day" data-today={m.today || undefined} style={{ '--i': i }}>
            <DayMark look={m.look} />
            <span className="stk-week__name" aria-hidden="true">{m.name}</span>
            <span className="sr-only">{m.label}</span>
          </li>
        ))}
      </ol>
      {legend ? <p className="stk-hint">{legend}</p> : null}
    </div>
  );
}

/** Two rest-pass slots and what the next one takes (S3). */
export function PassSlots({ passes, compact = false }) {
  const held = passes?.held ?? 0;
  const max = passes?.max ?? 2;
  const line = passLine(passes);
  return (
    <span className="stk-pass" data-compact={compact || undefined}>
      <span className="stk-pass__slots" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => <span key={i} className="stk-pass__slot" data-held={i < held || undefined}><Moon size={14} strokeWidth={2.2} /></span>)}
      </span>
      <span className="stk-pass__text"><b>{line.title}</b>{line.next ? <span>{line.next}</span> : null}</span>
    </span>
  );
}

function Milestones({ body }) {
  const list = body?.streakMilestones || [];
  const line = milestoneLine(body);
  return (
    <section className="stk-sec" aria-labelledby="stk-ms-h">
      <h3 id="stk-ms-h" className="stk-sec__h">Milestones</h3>
      <ol className="stk-path">
        {list.map((m) => (
          <li key={m.at} className="stk-path__step" data-done={m.done || undefined}>
            <span className="stk-path__n">{m.at}</span>
            <span className="sr-only">{m.done ? `${daysWord(m.at)}, reached` : `${daysWord(m.at)}, ${m.left} to go`}</span>
          </li>
        ))}
      </ol>
      {line ? <p className="stk-hint">{line}</p> : <p className="stk-hint">Every milestone reached. The streak keeps counting.</p>}
    </section>
  );
}

/** Exam pause days (S8): choose days ahead on a month calendar, set them, or clear chosen ones. */
export function PausePicker({ body, userId, onDone }) {
  const [clockDay] = useState(() => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10));
  const today = body?.week?.[body.week.length - 1]?.day || clockDay;
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const paused = useMemo(() => new Set(body?.pause?.days || []), [body]);
  const left = Math.max(0, (body?.pause?.max ?? 14) - (body?.pause?.usedThisSeason ?? 0));
  const base = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + offset);
  const y = base.getUTCFullYear();
  const mth = base.getUTCMonth();
  const daysIn = new Date(Date.UTC(y, mth + 1, 0)).getUTCDate();
  const lead = (base.getUTCDay() + 6) % 7;
  const key = (d) => `${y}-${String(mth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const toggle = (k) => { setNote(''); setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k])); };
  const pickedPaused = picked.filter((k) => paused.has(k));
  const pickedNew = picked.filter((k) => !paused.has(k));
  const set = pauseSetLine(body?.pause, today);
  const send = async (method) => {
    setBusy(true);
    setNote('');
    const days = method === 'POST' ? pickedNew : pickedPaused;
    const r = await sendPause(userId, method, days);
    setBusy(false);
    if (!r.ok) { setNote(r.message); return; }
    setPicked([]);
    setNote(method === 'POST' ? `${days.length === 1 ? '1 day' : `${days.length} days`} paused. Your streak holds on them.` : 'Those days are no longer paused.');
    onDone?.();
  };
  return (
    <div className="stk-pause">
      <p className="stk-line">{pauseLine(body?.pause)}</p>
      {set ? <p className="stk-hint">{set}</p> : null}
      <div className="stk-cal">
        <div className="stk-cal__head">
          <button type="button" className="stk-icon" aria-label="Earlier month" disabled={offset <= 0} onClick={() => setOffset((o) => o - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <b>{MONTHS[mth]} {y}</b>
          <button type="button" className="stk-icon" aria-label="Later month" disabled={offset >= 5} onClick={() => setOffset((o) => o + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <ol className="stk-cal__grid" aria-label="Choose days to pause">
          {INITIALS.map((d, i) => <li key={`h${i}`} className="stk-cal__dow" aria-hidden="true">{d}</li>)}
          {Array.from({ length: lead }, (_, i) => <li key={`l${i}`} aria-hidden="true" />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const k = key(i + 1);
            const future = k > today;
            return (
              <li key={k}>
                <button type="button" className="stk-cal__day" disabled={!future} aria-pressed={picked.includes(k)} data-paused={paused.has(k) || undefined}
                  aria-label={`${weekdayOf(k)} ${i + 1}${paused.has(k) ? ', paused for exams' : ''}`} onClick={() => toggle(k)}>{i + 1}</button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="stk-keys">
        <button type="button" className="btn-volt md stk-key" disabled={busy || !pickedNew.length || pickedNew.length > left} onClick={() => send('POST')}>{pickedNew.length ? pauseKey(pickedNew.length) : 'Choose days to pause'}</button>
        {pickedPaused.length ? <button type="button" className="stk-key stk-key--line" disabled={busy} onClick={() => send('DELETE')}>{pickedPaused.length === 1 ? 'Clear 1 day' : `Clear ${pickedPaused.length} days`}</button> : null}
      </div>
      {pickedNew.length > left ? <p className="stk-hint">You can pause {left} more {left === 1 ? 'day' : 'days'} this season.</p> : null}
      <p className="stk-note" role="status" aria-live="polite">{note}</p>
    </div>
  );
}

/** The streak sheet: one per page, mounted by the app layout; opened from any place with openStreakSheet(). */
export default function StreakSheet({ userId }) {
  const { open, view: asked } = useStreakSheet();
  const { status, data: body, reload } = useStreak(open ? userId : null);
  const [view, setView] = useState('streak');
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) { setView(asked); el.showModal(); }
    if (!open && el.open) el.close();
  }, [open, asked]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const closed = () => closeStreakSheet();
    el.addEventListener('close', closed);
    return () => el.removeEventListener('close', closed);
  }, []);
  const status1 = body ? statusLine(body) : null;
  return (
    <dialog ref={ref} className="stk-sheet" aria-labelledby="stk-sheet-h" onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      {open ? (
        <div className="stk-sheet__body" data-view={view}>
          <header className="stk-sheet__head">
            {view === 'pause' && asked !== 'pause' ? (
              <button type="button" className="stk-icon" aria-label="Back to your streak" onClick={() => setView('streak')}><ChevronLeft size={20} aria-hidden="true" /></button>
            ) : null}
            <h2 id="stk-sheet-h" className="stk-sheet__title">{view === 'pause' ? PAUSE_TITLE : STREAK_NAME}</h2>
            <button type="button" className="stk-icon stk-sheet__x" aria-label="Close" onClick={() => ref.current?.close()}><X size={20} aria-hidden="true" /></button>
          </header>
          {!body && status === 'error' ? (
            <p className="stk-line" role="status">Your streak did not load. <button type="button" className="stk-inline" onClick={reload}>Try again</button></p>
          ) : !body ? (
            <div className="stk-wait" aria-busy="true"><span /><span /><span /></div>
          ) : view === 'pause' ? (
            <PausePicker body={body} userId={userId} />
          ) : (
            <>
              <div className="stk-hero" data-zero={body.days === 0 || undefined}>
                {body.days > 0 ? <b className="stk-hero__n">{body.days}</b> : null}
                <span className="stk-hero__text">
                  <b>{body.days === 0 ? 'Your streak starts with one day' : body.days === 1 ? 'day in a row' : 'days in a row'}</b>
                  <span>{body.best > body.days ? `Your best is ${daysWord(body.best)}.` : body.days > 0 ? 'This is your best yet.' : 'Each day that counts adds one.'}</span>
                </span>
              </div>
              {status1 ? <p className="stk-line stk-line--status" data-tone={status1.tone}>{status1.text}{status1.sub ? <span className="stk-hint">{status1.sub}</span> : null}</p> : null}
              <StreakWeek body={body} />
              <section className="stk-sec" aria-labelledby="stk-pass-h">
                <h3 id="stk-pass-h" className="stk-sec__h">Rest passes</h3>
                <PassSlots passes={body.passes} />
                <p className="stk-hint">{passRule(body.rule)}</p>
              </section>
              <Milestones body={body} />
              <section className="stk-sec" aria-labelledby="stk-rule-h">
                <h3 id="stk-rule-h" className="stk-sec__h">What counts</h3>
                <p className="stk-line">{ruleLine(body.rule?.answers ?? body.today?.needed)} {makeUpRule(body.rule)}</p>
              </section>
              <div className="stk-keys">
                <button type="button" className="stk-key stk-key--line" onClick={() => setView('pause')}>{PAUSE_TITLE}</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
