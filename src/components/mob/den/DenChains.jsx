"use client";
// Chains on the web (MOB-BUILD-SPEC-V3 5.3 C1, C2, P5). Tabs "You" and the Mob. The personal chain (GET /api/me/chain)
// never warns: no flames, no countdown, no "at risk" (spec 6.7). Rest passes apply themselves, make-up is free, exam pause
// days hold it, and "Hide my chain" hides it from everyone (it still counts). The Mob's chain is the pennant: weeks the
// whole Mob finished its quest, filled by game, never by person, and never "N of you" (C2).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Moon, Package } from 'lucide-react';
import { DenCopy, MobTime, denError } from '@/lib/mob/v3/denCopy.mjs';
import { questEach, questSegments } from '@/lib/mob/v3/denModel.mjs';
import { MobDialog } from '../MobDialog';
import { mobFetch, useMob } from '../useMob';
import { Pennant } from './DenStage';
import { FoldFigure } from './FoldFigure';
import './den.css';

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

function Tick({ day, today = false }) {
  const s = day.state;
  return (
    <li className="den-tick" data-state={s} data-today={today || undefined}>
      <span className="den-tick__paper" aria-hidden="true">
        {s === 'practised' || s === 'made_up' ? <Check size={16} strokeWidth={2.6} /> : null}
        {s === 'rested' ? <Moon size={14} /> : null}
        {s === 'today' ? <span className="den-tick__today">{DenCopy.todayProgress(day.answered ?? 0, day.needed ?? 5)}</span> : null}
      </span>
      <span className="den-tick__day" aria-hidden="true">{MobTime.weekdayOfKey(day.day).slice(0, 1)}</span>
      <span className="sr-only">{`${MobTime.weekdayOfKey(day.day)}, ${DenCopy.dayState(s)}`}</span>
    </li>
  );
}

function Calendar({ calendar }) {
  // The current month from the server's calendar, Monday first.
  const month = useMemo(() => {
    const today = istToday();
    const prefix = today.slice(0, 7);
    const days = (calendar || []).filter((d) => d.day.startsWith(prefix));
    if (!days.length) return null;
    const first = new Date(`${prefix}-01T00:00:00Z`).getUTCDay();
    return { prefix, lead: (first + 6) % 7, days, today };
  }, [calendar]);
  if (!month) return null;
  return (
    <section className="den-cal" aria-labelledby="den-cal-h">
      <header className="den-cal__head">
        <h3 id="den-cal-h" className="den-sheet__h">{MobTime.monthName(Number(month.prefix.slice(5, 7)))}</h3>
        <span className="mob-hint">{DenCopy.calendarCaption}</span>
      </header>
      <ol className="den-cal__grid">
        {DenCopy.dayInitials.map((d, i) => <li key={`h${i}`} className="den-cal__dow" aria-hidden="true">{d}</li>)}
        {Array.from({ length: month.lead }, (_, i) => <li key={`l${i}`} aria-hidden="true" />)}
        {month.days.map((d) => (
          <li key={d.day} className="den-cal__day" data-state={d.state} data-today={d.day === month.today || undefined}>
            <span aria-hidden="true">{Number(d.day.slice(8))}</span>
            <span className="sr-only">{`${Number(d.day.slice(8))}, ${DenCopy.dayState(d.state)}`}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** P5. Exam pause days: choose future days on a month calendar; "Pause n days"; or clear chosen paused days. */
function PauseSheet({ open, onClose, chain, onChain }) {
  const today = istToday();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const paused = useMemo(() => new Set(chain.pause?.days || []), [chain]);
  const left = Math.max(0, (chain.pause?.max ?? 14) - (chain.pause?.usedThisSeason ?? 0));
  const base = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + offset);
  const y = base.getUTCFullYear();
  const mth = base.getUTCMonth();
  const daysIn = new Date(Date.UTC(y, mth + 1, 0)).getUTCDate();
  const lead = (base.getUTCDay() + 6) % 7;
  const key = (d) => `${y}-${String(mth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const pickedPaused = picked.filter((k) => paused.has(k));
  const pickedNew = picked.filter((k) => !paused.has(k));
  const send = async (method) => {
    setBusy(true);
    setError(null);
    const r = await mobFetch('/api/me/chain/pause', { method, body: { days: method === 'POST' ? pickedNew : pickedPaused } });
    setBusy(false);
    if (!r.ok) { setError(denError(r)); return; }
    onChain(r.data);
    setPicked([]);
  };
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.examPause} labelId="den-p5-h">
      <p className="mob-note">{DenCopy.pauseLine(left)}</p>
      <div className="den-pcal">
        <div className="den-pcal__head">
          <button type="button" className="mob-icon" aria-label={DenCopy.earlierMonth} disabled={offset <= 0} onClick={() => setOffset((o) => o - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <b>{MobTime.monthName(mth + 1)} {y}</b>
          <button type="button" className="mob-icon" aria-label={DenCopy.laterMonth} disabled={offset >= 5} onClick={() => setOffset((o) => o + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <ol className="den-pcal__grid" aria-label={DenCopy.pickDays}>
          {DenCopy.dayInitials.map((d, i) => <li key={`h${i}`} className="den-cal__dow" aria-hidden="true">{d}</li>)}
          {Array.from({ length: lead }, (_, i) => <li key={`l${i}`} aria-hidden="true" />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const k = key(i + 1);
            const future = k > today;
            const on = picked.includes(k);
            return (
              <li key={k}>
                <button type="button" className="den-pcal__day" disabled={!future} aria-pressed={on} data-paused={paused.has(k) || undefined}
                  aria-label={`${MobTime.weekdayOfKey(k)} ${i + 1}${paused.has(k) ? `, ${DenCopy.dayState('paused')}` : ''}`} onClick={() => toggle(k)}>{i + 1}</button>
              </li>
            );
          })}
        </ol>
      </div>
      <button type="button" className="btn-volt md den-sheet__key" disabled={busy || !pickedNew.length || pickedNew.length > left} onClick={() => send('POST')}>{DenCopy.pauseKey(pickedNew.length || 0)}</button>
      {pickedPaused.length ? <button type="button" className="mob-key" disabled={busy} onClick={() => send('DELETE')}>{DenCopy.clearDays}</button> : null}
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </MobDialog>
  );
}

function YouTab({ chain, setChain }) {
  const [pauseOpen, setPauseOpen] = useState(false);
  const [error, setError] = useState(null);
  const hide = async (hidden) => {
    setError(null);
    const r = await mobFetch('/api/me/chain', { method: 'PATCH', body: { hidden } });
    if (!r.ok) { setError(denError(r)); return; }
    setChain(r.data);
  };
  if (chain.hidden) {
    return (
      <section className="den-panel">
        <p className="mob-note">{DenCopy.hiddenLine}</p>
        <button type="button" className="mob-key" onClick={() => hide(false)}>{DenCopy.showChain}</button>
        <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
      </section>
    );
  }
  const left = Math.max(0, (chain.today?.needed ?? 5) - (chain.today?.answered ?? 0));
  const next = (chain.milestones || []).find((m) => !m.done);
  return (
    <section className="den-panel">
      <div className="den-figure">
        <b className="den-figure__n">{chain.days}</b>
        <span className="den-figure__text"><b>{DenCopy.daysInARow(chain.days)}</b><span>{chain.days === 0 && chain.best > 0 ? DenCopy.newChain(chain.best) : DenCopy.chainBreakdown(chain)}</span></span>
      </div>
      <ol className="den-ticks-row">
        {(chain.week || []).map((d) => <Tick key={d.day} day={{ ...d, needed: chain.today?.needed }} today={d.state === 'today'} />)}
      </ol>
      {!chain.today?.done && left > 0 ? <p className="mob-hint">{DenCopy.answerMore(left)}</p> : null}
      <div className="den-pass">
        <span className="den-pass__icons" aria-hidden="true">{Array.from({ length: Math.max(1, chain.passes?.max ?? 2) }, (_, i) => <span key={i} className="den-pass__icon" data-held={i < (chain.passes?.held ?? 0) || undefined}><Moon size={14} /></span>)}</span>
        <span className="den-pass__text"><b>{DenCopy.passesHeld(chain.passes?.held ?? 0, chain.passes?.max ?? 2)}</b><span>{DenCopy.passesRule}</span></span>
      </div>
      {chain.makeUp ? (
        <div className="den-pass den-pass--makeup">
          <span className="den-pass__text"><span>{DenCopy.makeUpOpen(MobTime.weekdayOfKey(chain.makeUp.day), chain.makeUp.needed)}</span><span className="mob-hint">{DenCopy.makeUpProgress(chain.makeUp.answeredToday ?? 0, chain.makeUp.needed)}</span></span>
        </div>
      ) : null}
      <Calendar calendar={chain.calendar} />
      <section aria-labelledby="den-ms-h">
        <h3 id="den-ms-h" className="den-sheet__h">{DenCopy.onTheWay}</h3>
        <ol className="den-path">
          {(chain.milestones || []).filter((m) => m.reward !== 'ribbon' || m.at <= 50).map((m) => (
            <li key={m.at} className="den-path__step" data-done={m.done || undefined}>
              <span className="den-path__n">{m.at}</span>
              <span className="den-path__text">{DenCopy.milestone(m)}</span>
              {m.done ? <Check size={16} aria-hidden="true" className="den-path__tick" /> : m === next && Number.isFinite(m.left) ? <span className="mob-hint">{DenCopy.moreDays(m.left)}</span> : null}
            </li>
          ))}
        </ol>
      </section>
      <div className="den-panel__links">
        <button type="button" className="mob-link" onClick={() => setPauseOpen(true)}>{DenCopy.examPause}</button>
        <button type="button" className="mob-link" onClick={() => hide(true)}>{DenCopy.hideChain}</button>
      </div>
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
      {pauseOpen ? <PauseSheet open onClose={() => setPauseOpen(false)} chain={chain} onChain={setChain} /> : null}
    </section>
  );
}

function MobTab({ data, run, busy }) {
  const v3 = data.v3;
  const mobName = v3.name?.text || data.subjectName;
  const q = v3.quest || {};
  const c = v3.mobChain || {};
  const seg = questSegments(q);
  const [error, setError] = useState(null);
  const stepOut = async (on) => {
    setError(null);
    const r = await run('/api/mob/step-out', { on }, { name: 'step-out' });
    if (!r.ok) setError(denError(r));
  };
  return (
    <section className="den-panel">
      <div className="den-figure den-figure--pennant">
        <Pennant weeks={c.weeks ?? 0} size={72} />
        <span className="den-figure__text">
          <b>{`${c.weeks ?? 0} ${DenCopy.weeksInARow(c.weeks ?? 0)}`}</b>
          <span>{c.restarted ? DenCopy.newMobChain(c.best ?? 0) : DenCopy.mobChainLine(mobName)}</span>
          <span className="mob-hint">{DenCopy.bestRun(c.best ?? 0)}</span>
        </span>
      </div>
      <div className="den-card den-card--quest">
        <span className="den-card__corner" aria-hidden="true" />
        <h3 className="den-card__title">{DenCopy.questTitle}</h3>
        <p className="mob-hint">{DenCopy.questEnds}</p>
        <p className="den-card__line">{DenCopy.questGoal(q.target)}</p>
        <p className="den-quest__big"><b>{q.answered}</b> {DenCopy.questTail(q.answered, q.target)}</p>
        <span className="den-quest__bar den-quest__bar--wide" aria-hidden="true">
          {Array.from({ length: seg.n }, (_, i) => <span key={i} className="den-quest__seg" data-full={i < seg.full || undefined} data-part={i === seg.full && seg.part > 0 || undefined} style={i === seg.full && seg.part > 0 ? { '--part': seg.part } : undefined} />)}
        </span>
        {(q.bySource || []).length ? (
          <>
            <h4 className="den-sheet__h">{DenCopy.whatFilled}</h4>
            <ul className="den-filled">{q.bySource.map((b) => <li key={b.label}><span>{b.label}</span><b>{b.answered}</b></li>)}</ul>
          </>
        ) : null}
        <div className="den-parcelrow">
          {q.parcel?.kind === 'fold' ? <FoldFigure fold={q.parcel.fold} size={56} locked /> : <span className="den-parcelrow__icon" aria-hidden="true"><Package size={26} strokeWidth={1.6} /></span>}
          <p className="mob-note">{DenCopy.parcelHolds(q.parcel, mobName)}</p>
        </div>
      </div>
      <section aria-labelledby="den-counts-h">
        <h3 id="den-counts-h" className="den-sheet__h">{DenCopy.howItCounts}</h3>
        <p className="mob-note">{DenCopy.countsLine(q.sizedFor ?? 1, questEach(q))}</p>
        {!q.done ? <button type="button" className="mob-link" disabled={busy === 'step-out'} onClick={() => stepOut(!q.youSteppedOut)}>{q.youSteppedOut ? DenCopy.steppedOut : DenCopy.stepOut}</button> : null}
      </section>
      <section aria-labelledby="den-path-h">
        <h3 id="den-path-h" className="den-sheet__h">{DenCopy.onTheWay}</h3>
        <ol className="den-path">
          {DenCopy.mobPath.map((p) => (
            <li key={p.at} className="den-path__step" data-done={(c.best ?? 0) >= p.at || undefined}>
              <span className="den-path__n">{p.at}</span><span className="den-path__text">{p.text}</span>
              {(c.best ?? 0) >= p.at ? <Check size={16} aria-hidden="true" className="den-path__tick" /> : null}
            </li>
          ))}
        </ol>
      </section>
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </section>
  );
}

export default function DenChains({ user }) {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'mob' ? 'mob' : 'you');
  const mob = useMob(user?.id);
  const [chain, setChain] = useState({ status: 'loading', data: null });
  const load = useCallback(async () => {
    setChain((c) => ({ ...c, status: c.data ? 'ready' : 'loading' }));
    const r = await mobFetch('/api/me/chain');
    setChain(r.ok ? { status: 'ready', data: r.data } : { status: 'error', data: null });
  }, []);
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [user?.id, load]);
  const data = mob.mob;
  const hasMob = Boolean(data?.v3);
  const mobName = hasMob ? (data.v3.name?.text || data.subjectName) : '';
  return (
    <div className="student-page student-page--mob">
      <section className="pr ov den-page">
        <header className="den-page__head">
          <Link href="/mob" className="mob-icon" aria-label={DenCopy.backToDen}><ArrowLeft size={20} aria-hidden="true" /></Link>
          <h1 className="den-page__title">{DenCopy.chainsTitle}</h1>
        </header>
        <div className="den-tabs" role="tablist" aria-label={DenCopy.chainsTitle}>
          <button type="button" role="tab" className="den-tabs__tab" aria-selected={tab === 'you'} onClick={() => setTab('you')}>{DenCopy.tabYou}</button>
          {hasMob ? <button type="button" role="tab" className="den-tabs__tab" aria-selected={tab === 'mob'} onClick={() => setTab('mob')}>{mobName}</button> : null}
        </div>
        {tab === 'you' ? (
          chain.status === 'loading' ? <p className="mob-hint" role="status">{DenCopy.chainLoading}</p>
            : chain.status === 'error' ? <div role="alert"><p className="mob-note">{DenCopy.chainFailed}</p><button type="button" className="mob-key" onClick={load}>{DenCopy.tryAgain}</button></div>
              : <YouTab chain={chain.data} setChain={(d) => setChain({ status: 'ready', data: d })} />
        ) : hasMob ? <MobTab data={data} run={mob.run} busy={mob.busy} /> : <p className="mob-hint" role="status">{DenCopy.loading}</p>}
      </section>
    </div>
  );
}
