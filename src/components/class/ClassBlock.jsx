"use client";
// "Your class" on the Sunday Mock page (/sunday#class): the class league's home. The register's ink top says what this is and
// whose class; the paper under it holds this week's job:
//   fresh      no class: what it is and how it runs every week, a code field, and Start a class (a dialog)
//   waiting    in a class before its first closed Sunday: when the first figure comes, and the code to share
//   figure     after a Sunday's answers open: per subject, the class average and your marks on a ruler, how many sat;
//              under 5 sitters, the floor's line only
// Then the code to share (the class grows through its own group) and Class settings (leave, close, report: a dialog).
// Every state is drawn: loading (the register's frame), error (Try again), off (nothing). One volt key per view: on this page
// the Sunday Mock's start key is the volt, so every key here is quiet; each dialog's own key is its volt.
// Owner's direction, 16 Nov 2026: bold, in MockMob's identity, say plainly what it is and how it runs every week.
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { Flag, LogOut, School, ShieldAlert, XCircle } from 'lucide-react';
import {
  CLASS_COPY, CLASS_NAME_MAX, FIRST_FIGURE_LINE, checkClassName, figureOpensLine, firstFigureTitle, membersLine, nextFigureLine,
} from '@/lib/classLeague/model.mjs';
import { ClassDialog, ClassFigure, CodeForm, ShareKeys } from './ClassParts';
import { classWrite, useClassLeague } from './useClassLeague';
import './class.css';

function Band({ title, meta = null, lede = null, as = 'h2', id }) {
  const H = as;
  return (
    <header className="cls-band">
      <p className="cls-stamp"><School size={18} strokeWidth={2} aria-hidden="true" />{CLASS_COPY.name}</p>
      <H id={id}>{title}</H>
      {meta}
      {lede ? <p className="cls-band__lede">{lede}</p> : null}
    </header>
  );
}

/** How it runs every week, in three plain lines. */
export function ClassSteps() {
  return (
    <ol className="cls-steps">
      {CLASS_COPY.rules.map((line) => <li key={line}>{line}</li>)}
    </ol>
  );
}

/** Start a class: the name, the subjects (the student's own, all ticked), the volt key. Then the code to share. */
function CreateDialog({ open, onClose, subjects, onCreated }) {
  const nameId = useId();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(() => new Set(subjects.map((s) => s.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState(null);
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const checked = checkClassName(name);
    if (!checked.ok) { setError(checked.code === 'NAME_REFUSED' ? 'Choose a different name. Everyone with the code sees it.' : `Use 3 to ${CLASS_NAME_MAX} letters and numbers for the class name.`); return; }
    if (!picked.size) { setError('Choose at least one of your subjects.'); return; }
    setBusy(true);
    setError('');
    const r = await classWrite('/api/class', { name: checked.name, subjects: subjects.filter((s) => picked.has(s.id)).map((s) => s.id) });
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setMade(r.data);
  };
  // The block turns into the class only when this dialog closes, so the code to share stays in front of the student.
  const done = () => { if (made) onCreated(made); onClose(); };
  return (
    <ClassDialog open={open} onClose={done} title={made ? 'Your class is ready' : CLASS_COPY.startTitle}>
      {made?.class ? (
        <>
          <p className="cls-note">{`${made.class.name}. ${figureOpensLine(made.next)}`}</p>
          <ShareKeys name={made.class.name} code={made.class.code} url={made.class.url} volt />
        </>
      ) : (
        <form className="cls-menu" onSubmit={submit} noValidate>
          <div className="cls-field">
            <label className="cls-label" htmlFor={nameId}>{CLASS_COPY.nameLabel}</label>
            <input id={nameId} className="cls-input" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} maxLength={CLASS_NAME_MAX}
              autoComplete="off" placeholder="XII-C Commerce, DPS Rohini" aria-describedby={`${nameId}-hint`} />
            <p id={`${nameId}-hint`} className="cls-small">{CLASS_COPY.nameHint}</p>
          </div>
          <fieldset className="cls-checks">
            <legend className="cls-label">{CLASS_COPY.subjectsLabel}</legend>
            {subjects.map((s) => (
              <label key={s.id} className="cls-check">
                <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                <span aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                <b>{s.name}</b>
              </label>
            ))}
            <p className="cls-small">{CLASS_COPY.subjectsHint}</p>
          </fieldset>
          <button type="submit" className="cls-key cls-key--volt cls-key--wide" disabled={busy} aria-busy={busy || undefined}>{busy ? CLASS_COPY.starting : CLASS_COPY.createKey}</button>
          <p className="cls-msg" role="status" aria-live="polite">{error}</p>
        </form>
      )}
    </ClassDialog>
  );
}

/** Class settings: leave (or close, for the student who started it) and report, each with its own confirm step. */
function SettingsDialog({ open, onClose, cls, onGone }) {
  const [step, setStep] = useState('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { setStep('menu'); setError(''); onClose(); };
  const act = async (path, body, next) => {
    if (busy) return;
    setBusy(true);
    setError('');
    const r = await classWrite(path, body);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    if (next) setStep(next); else { setStep('menu'); onGone(); }
  };
  return (
    <ClassDialog open={open} onClose={close} title={CLASS_COPY.settings}>
      {step === 'menu' ? (
        <div className="cls-menu">
          <p className="cls-note">{`${cls.name}. ${membersLine(cls.members)}.${cls.creator ? ' You started it.' : ''}`}</p>
          {cls.creator
            ? <button type="button" className="cls-menu__item cls-menu__item--bad" onClick={() => setStep('close')}><XCircle size={18} aria-hidden="true" />{CLASS_COPY.close}</button>
            : <button type="button" className="cls-menu__item cls-menu__item--bad" onClick={() => setStep('leave')}><LogOut size={18} aria-hidden="true" />{CLASS_COPY.leave}</button>}
          <button type="button" className="cls-menu__item" onClick={() => setStep('report')}><Flag size={18} aria-hidden="true" />{CLASS_COPY.report}</button>
        </div>
      ) : null}
      {step === 'leave' || step === 'close' ? (
        <div className="cls-menu">
          <p className="cls-note">{step === 'leave' ? CLASS_COPY.leaveLine : CLASS_COPY.closeLine}</p>
          <button type="button" className="cls-key cls-key--bad cls-key--wide" disabled={busy} aria-busy={busy || undefined}
            onClick={() => act(step === 'leave' ? '/api/class/leave' : '/api/class/close', {}, null)}>
            {busy ? (step === 'leave' ? 'Leaving' : 'Closing') : step === 'leave' ? CLASS_COPY.leave : CLASS_COPY.close}
          </button>
          <button type="button" className="cls-link" onClick={() => setStep('menu')}>Keep it</button>
        </div>
      ) : null}
      {step === 'report' ? (
        <div className="cls-menu">
          <p className="cls-note">{CLASS_COPY.reportLine}</p>
          <button type="button" className="cls-menu__item" disabled={busy} onClick={() => act('/api/class/report', { reason: 'name' }, 'reported')}><Flag size={18} aria-hidden="true" />{CLASS_COPY.reasons.name}</button>
          <button type="button" className="cls-menu__item" disabled={busy} onClick={() => act('/api/class/report', { reason: 'safety' }, 'reported')}><ShieldAlert size={18} aria-hidden="true" />{CLASS_COPY.reasons.safety}</button>
        </div>
      ) : null}
      {step === 'reported' ? (
        <div className="cls-menu">
          <p className="cls-note">{`${CLASS_COPY.reported}${cls.creator ? '' : ' You can also leave the class.'}`}</p>
          {!cls.creator ? <button type="button" className="cls-key cls-key--bad" onClick={() => setStep('leave')}>{CLASS_COPY.leave}</button> : null}
          <button type="button" className="cls-link" onClick={close}>Done</button>
        </div>
      ) : null}
      <p className="cls-msg" role="status" aria-live="polite">{error}</p>
    </ClassDialog>
  );
}

function Fresh({ data, onJoined, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const join = async (code) => {
    setBusy(true);
    setError('');
    const r = await classWrite('/api/class/join', { code });
    setBusy(false);
    if (!r.ok) { setError(r.code === 'ALREADY_IN_CLASS' && r.detail?.className ? `You are in ${r.detail.className}. Leave it first to join another.` : r.message); return; }
    onJoined(r.data);
  };
  const subjects = data.subjects || [];
  return (
    <>
      <Band id="cls-h" title="Your class, every Sunday" lede={CLASS_COPY.what} />
      <div className="cls-body">
        <div className="cls-row">
          <h3>How it runs every week</h3>
          <ClassSteps />
        </div>
        <div className="cls-row">
          <CodeForm onJoin={join} busy={busy} error={error} />
        </div>
        <div className="cls-row">
          <h3>No code yet?</h3>
          <p className="cls-note">Start your class and share its code in your class group. A teacher or a class rep usually does this once.</p>
          {subjects.length ? (
            <div className="cls-keys"><button type="button" className="cls-key" onClick={() => setCreating(true)}>{CLASS_COPY.start}</button></div>
          ) : (
            <div className="cls-keys">
              <p className="cls-small">{CLASS_COPY.noSubjects}</p>
              <Link className="cls-key" href="/onboarding?edit=true">{CLASS_COPY.addSubjects}</Link>
            </div>
          )}
        </div>
      </div>
      {creating ? <CreateDialog open={creating} onClose={() => setCreating(false)} subjects={subjects} onCreated={onCreated} /> : null}
    </>
  );
}

function InClass({ data, onGone }) {
  const cls = data.class;
  const [settings, setSettings] = useState(false);
  const meta = (
    <p className="cls-band__meta">
      <span><b>{cls.members.toLocaleString('en-IN')}</b> {cls.members === 1 ? 'member' : 'members'}</span>
      <span>{cls.subjects.map((s) => s.name).join(', ')}</span>
    </p>
  );
  return (
    <>
      <Band id="cls-h" title={cls.name} meta={meta} />
      <div className="cls-body">
        {data.week?.figures?.length ? data.week.figures.map((f) => <ClassFigure key={f.subject} figure={f} week={data.week.week} reveal />) : (
          <div className="cls-row">
            <h3>{firstFigureTitle(data.next)}</h3>
            <p className="cls-note">{FIRST_FIGURE_LINE}</p>
          </div>
        )}
        {data.week?.figures?.length ? <p className="cls-small cls-next">{nextFigureLine(data.next)}</p> : null}
        <ShareKeys name={cls.name} code={cls.code} url={cls.url} />
        <div className="cls-row cls-row--end">
          <div className="cls-keys"><button type="button" className="cls-link" onClick={() => setSettings(true)}>{CLASS_COPY.settings}</button></div>
        </div>
      </div>
      {settings ? <SettingsDialog open={settings} onClose={() => setSettings(false)} cls={cls} onGone={() => { setSettings(false); onGone(); }} /> : null}
    </>
  );
}

/** The block. `id` is the anchor the Mob page's entry and Today's card open (/sunday#class). */
export default function ClassBlock() {
  const league = useClassLeague(true);
  // The anchor: a link to /sunday#class lands here once the block has drawn (the page draws it after its read).
  const ready = league.status === 'ready';
  useEffect(() => {
    if (!ready || typeof window === 'undefined' || window.location.hash !== '#class') return;
    document.getElementById('class')?.scrollIntoView({ block: 'start' });
  }, [ready]);
  if (league.status === 'off') return null;
  if (league.status === 'loading') {
    return (
      <section className="cls cls--wait" aria-busy="true" aria-label="Loading your class">
        <div className="cls-band"><i /><i /></div>
        <div className="cls-body"><i /></div>
      </section>
    );
  }
  if (league.status === 'error' || !league.data) {
    return (
      <section className="cls" id="class" aria-labelledby="cls-h">
        <Band id="cls-h" title={CLASS_COPY.blockTitle} />
        <div className="cls-body">
          <div className="cls-row" role="alert">
            <p className="cls-note">{CLASS_COPY.loadFailed} Your class and its figures are safe.</p>
            <div className="cls-keys"><button type="button" className="cls-key" onClick={league.reload}>{CLASS_COPY.tryAgain}</button></div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="cls" id="class" aria-labelledby="cls-h">
      {league.data.class
        ? <InClass data={league.data} onGone={league.reload} />
        : <Fresh data={league.data} onJoined={league.accept} onCreated={league.accept} />}
    </section>
  );
}
