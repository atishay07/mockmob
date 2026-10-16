"use client";

// My colleges on the website: Today's short ladder, the full ordered list on Account, and the
// "Add to my colleges" key on a Compass college row. All three read and write the one server list
// (useMyColleges, /api/me/colleges), the same list the app uses. Nothing here invents a number:
// the count is the list's own, and a list that has not loaded says so instead of showing zero.
import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { useMyColleges } from './useMyColleges';
import {
  EMPTY_LINE, FULL_LINE, MAX_COLLEGES, countLine, entryKey, hasEntry, ladderView, moreLine,
} from '@/lib/colleges/model.mjs';
import './colleges.css';

const COMPASS_HREF = '/admission-compass';
const LIST_HREF = '/profile#colleges';

function Place({ n }) {
  return <span className="mc-place" aria-hidden="true">{n}</span>;
}

function Loading() {
  return (
    <ul className="mc-list" aria-busy="true" aria-label="Loading your colleges">
      {[0, 1, 2].map((i) => <li key={i} className="mc-row mc-row--quiet"><span className="mc-bar" /></li>)}
    </ul>
  );
}

function Failed({ onRetry }) {
  return (
    <p className="mc-note" role="status">
      Your colleges did not load. <button type="button" className="mc-link" onClick={onRetry}>Try again</button>
    </p>
  );
}

function Empty() {
  return (
    <div className="mc-empty">
      <p>{EMPTY_LINE}</p>
      <Link className="mc-key" href={COMPASS_HREF}><Plus size={16} aria-hidden="true" />Find colleges</Link>
    </div>
  );
}

/** Today: the first 3, and a count of the rest. */
export function TodayColleges({ userId }) {
  const mine = useMyColleges(userId);
  // Today is a glance, not a place to fail: a list that did not load leaves the card out (Account says so and retries).
  if (!userId || mine.status === 'error') return null;
  const { shown, more } = ladderView(mine.colleges);
  return (
    <section className="glass mc-card" aria-labelledby="mc-today-h" data-state={mine.status}>
      <header className="mc-head">
        <h2 id="mc-today-h" className="mc-h2">My colleges</h2>
        {mine.status === 'ready' && mine.colleges.length ? <Link className="mc-link" href={LIST_HREF}>Edit colleges</Link> : null}
      </header>
      {mine.status === 'loading' || mine.status === 'idle' ? <Loading /> : null}
      {mine.status === 'ready' && !mine.colleges.length ? <Empty /> : null}
      {mine.status === 'ready' && mine.colleges.length ? (
        <>
          <ol className="mc-list">
            {shown.map((c) => (
              <li key={entryKey(c)} className="mc-row">
                <Place n={c.position} />
                <span className="mc-name"><b>{c.college}</b>{c.programme ? <span>{c.programme}</span> : null}</span>
              </li>
            ))}
          </ol>
          {more > 0 ? <Link className="mc-more" href={LIST_HREF}>{moreLine(more)}</Link> : null}
        </>
      ) : null}
    </section>
  );
}

/** Account: the whole list, in order, with a way to reorder and remove. */
export function AccountColleges({ userId }) {
  const mine = useMyColleges(userId);
  const { colleges, busy } = mine;
  // The last removal, so it can be undone: added back, then moved to the place it had.
  const [undo, setUndo] = useState(null);
  const restore = async () => {
    const back = undo;
    setUndo(null);
    if (!back) return;
    const end = colleges.length; // the restored college lands last, at this index
    const ok = await mine.add(back.entry);
    if (ok && back.at < end) await mine.move(end, back.at);
  };
  return (
    <section className="glass mc-card" id="colleges" aria-labelledby="mc-account-h" data-state={mine.status}>
      <header className="mc-head">
        <h2 id="mc-account-h" className="mc-h2">My colleges</h2>
        {mine.status === 'ready' ? <span className="mc-count">{countLine(colleges.length)}</span> : null}
      </header>
      <p className="mc-lede">The same list in the app. Today shows your first 3, so put your top choices first.</p>
      {mine.status === 'loading' || mine.status === 'idle' ? <Loading /> : null}
      {mine.status === 'error' ? <Failed onRetry={mine.retry} /> : null}
      {mine.status === 'ready' && !colleges.length ? <Empty /> : null}
      {mine.status === 'ready' && colleges.length ? (
        <ol className="mc-list">
          {colleges.map((c, i) => (
            <li key={entryKey(c)} className="mc-row mc-row--edit">
              <Place n={c.position} />
              <span className="mc-name"><b>{c.college}</b>{c.programme ? <span>{c.programme}</span> : null}</span>
              {/* aria-disabled, not disabled: a disabled button drops keyboard focus to the page after every move. */}
              <span className="mc-tools">
                <button type="button" className="mc-icon" aria-disabled={busy || i === 0 || undefined} onClick={() => { if (!busy && i > 0) mine.move(i, i - 1); }} aria-label={`Move ${c.college} up`}><ArrowUp size={18} aria-hidden="true" /></button>
                <button type="button" className="mc-icon" aria-disabled={busy || i === colleges.length - 1 || undefined} onClick={() => { if (!busy && i < colleges.length - 1) mine.move(i, i + 1); }} aria-label={`Move ${c.college} down`}><ArrowDown size={18} aria-hidden="true" /></button>
                <button type="button" className="mc-icon mc-icon--remove" aria-disabled={busy || undefined} onClick={() => { if (busy) return; const at = i; mine.remove(c).then((ok) => { if (ok) setUndo({ entry: c, at }); }); }} aria-label={`Remove ${c.college} from My colleges`}><Trash2 size={18} aria-hidden="true" /></button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mc-foot">
        <p className="mc-notice" role="status" aria-live="polite">{mine.notice}{undo && mine.notice.startsWith('Removed') ? <> <button type="button" className="mc-undo" onClick={restore}>Undo</button></> : null}</p>
        {mine.status === 'ready' && colleges.length ? (
          colleges.length < MAX_COLLEGES
            ? <Link className="mc-key" href={COMPASS_HREF}><Plus size={16} aria-hidden="true" />Add from Admission Compass</Link>
            : <p className="mc-note">{FULL_LINE}</p>
        ) : null}
      </div>
    </section>
  );
}

/** A Compass college row's key: adds the college in this programme, or takes it off again. */
export function AddToMyColleges({ userId, programmeId, programme, college }) {
  const mine = useMyColleges(userId);
  if (!programmeId) return null;
  // Signed out: the save is still visible, as a quiet way in. The calculator keeps the chosen subjects on this
  // device, so they are still there after sign-in (T003, T004).
  if (!userId) return <Link className="mc-signin" href="/login?callbackUrl=%2Fcuet-cutoff-calculator">Sign in to save</Link>;
  const entry = { programmeId, programme, college };
  const on = hasEntry(mine.colleges, entry);
  const full = !on && mine.colleges.length >= MAX_COLLEGES;
  const unavailable = mine.status !== 'ready';
  if (full) return <span className="mc-full">My colleges is full</span>;
  return (
    <button
      type="button"
      className="mc-add"
      data-on={on || undefined}
      aria-pressed={on}
      disabled={unavailable || mine.busy}
      onClick={() => (on ? mine.remove(entry) : mine.add(entry))}
    >
      {on ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
      <span>{on ? 'In My colleges' : 'Add to my colleges'}</span>
      <span className="sr-only">{`, ${college}`}</span>
    </button>
  );
}
