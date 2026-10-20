"use client";
// No Mob yet, on the web, when the server offers v3 (MOB-BUILD-SPEC-V3 5.3 D0, D0a, J1).
//   D0: the lamp-lit room with your starter Fold and four dashed seats, the lead, "Start a Mob" and "Join with a code".
//   D0a: the setup, one question per screen under a live den (v3/explainer/MobSetup), after the explainer the first time.
//   The explainer (D166): the first Start a Mob or Join with a code on this device and account plays the 7 slides first;
//   "How the Mob works" under the two keys replays it. Skip and slide 7's keys go where the student was heading.
//   J1: six boxes (eight for an old code; a pasted link works), a preview with no names, the Fold, the name, then join.
// Sharing inside the Mob is said before anyone starts or joins. Nothing is shown as done before the server answers.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveSubject } from '@/../data/subject_registry';
import { checkName, suggestName } from '@/lib/mob/model.mjs';
import { DenCopy, denError } from '@/lib/mob/v3/denCopy.mjs';
import { STARTER_FOLDS, joinBoxes, parseJoinInput } from '@/lib/mob/v3/denModel.mjs';
import { MobDialog } from '../MobDialog';
import { mobFetch } from '../useMob';
import { DenStage } from './DenStage';
import { FoldFigure } from './FoldFigure';
import { FoldPick } from './DenSheets';
import { MobFlow, explainerSeen } from '../v3/explainer/MobFlow';
import { EXPLAINER_COPY } from '../v3/explainer/explainerModel.mjs';
import { SUBJECTS_HREF } from './denRoutes';
import './den.css';

function subjectsFrom(user) {
  const seen = new Set();
  const out = [];
  for (const raw of user?.subjects || []) {
    const s = resolveSubject(raw);
    if (!s.launch || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, name: s.officialName });
  }
  return out;
}

function NameInput({ id, label, value, onChange, error }) {
  return (
    <div className="mob-field">
      <label className="mob-label" htmlFor={id}>{label}</label>
      <input id={id} className="mob-input" value={value} maxLength={18} autoComplete="given-name" placeholder={DenCopy.nameHint}
        onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className={error ? 'mob-hint mob-hint--bad' : 'mob-hint'}>{error || DenCopy.nameNote}</p>
    </div>
  );
}

/** The code boxes: one real input under the six (or eight) painted boxes. Paste of a link or an old code is accepted. */
function CodeBoxes({ chars, onChange, inputRef, describedBy }) {
  // The dialog's showModal puts focus on its first control (Close); the code is what the student came to type.
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }, [inputRef]);
  const n = joinBoxes(chars);
  const boxes = Array.from({ length: n }, (_, i) => chars[i] || '');
  return (
    <div className="den-code-boxes" data-n={n} onClick={() => inputRef.current?.focus()}>
      <input ref={inputRef} className="den-code-boxes__input" value={chars} inputMode="text" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
        aria-label={DenCopy.joinCodeLabel} aria-describedby={describedBy} maxLength={64}
        onChange={(e) => onChange(parseJoinInput(e.target.value).chars)}
        onPaste={(e) => { e.preventDefault(); onChange(parseJoinInput(e.clipboardData.getData('text')).chars); }} />
      {boxes.map((c, i) => (
        <span key={i} className="den-code-box" data-filled={c ? true : undefined} data-cursor={i === Math.min(chars.length, n - 1) || undefined} data-gap={n === 6 && i === 3 ? true : undefined} aria-hidden="true">{c}</span>
      ))}
    </div>
  );
}

/** J1. Join with a code. `initialCode` comes from a /join/<code> link. */
export function JoinSheet({ open, onClose, user, mob, initialCode = '' }) {
  const [chars, setChars] = useState(() => parseJoinInput(initialCode).chars);
  const [answer, setAnswer] = useState({ code: null, status: 'idle', data: null, message: null });
  const [fold, setFold] = useState('dart');
  const [name, setName] = useState(() => suggestName(user?.name || '', user?.email || ''));
  const [nameError, setNameError] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const nameId = useId();
  const code = parseJoinInput(chars).code;
  // The lookup for the code on screen; a reply for an older code is ignored, so the boxes never show a stale preview.
  const look = !code ? { status: 'idle', data: null, message: null } : answer.code === code ? answer : { status: 'loading', data: null, message: null };
  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    const setLook = (v) => setAnswer({ code, ...v });
    mobFetch(`/api/mob/join/${code}`).then((r) => {
      if (!alive) return;
      if (r.ok && r.data?.valid !== false) setLook({ status: 'valid', data: r.data, message: null });
      else if (r.code === 'INVITE_EXPIRED') setLook({ status: 'bad', data: null, message: DenCopy.joinCodeExpired });
      else if (r.code === 'INVITE_INVALID' || (r.ok && r.data?.valid === false)) setLook({ status: 'bad', data: null, message: DenCopy.joinCodeInvalid });
      else if (r.code === 'JOIN_PAUSED') setLook({ status: 'bad', data: null, message: DenCopy.joinPaused });
      else setLook({ status: 'bad', data: null, message: denError(r) });
    });
    return () => { alive = false; };
  }, [code]);
  const join = async () => {
    setError(null);
    const checked = checkName(name);
    if (!checked.ok) { setNameError(DenCopy.nameRule); return; }
    setNameError(null);
    const r = await mob.run('/api/mob/join', { code, name: checked.name, colour: 0, fold }, { name: 'join' });
    if (!r.ok) {
      if (r.code?.startsWith('NAME') && r.code !== 'NAME_KEY_INVALID') setNameError(r.message);
      else setError(denError(r));
      return;
    }
    onClose();
  };
  const p = look.data;
  const mobName = p ? (p.name || p.subjectName) : '';
  const taken = p ? (p.size ?? (5 - (p.seatsLeft ?? 0))) : 0;
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.joinTitle} labelId="den-j1-h">
      <p id="den-j1-line" className="mob-note">{DenCopy.joinLine}</p>
      <CodeBoxes chars={chars} onChange={setChars} inputRef={inputRef} describedBy="den-j1-line" />
      {look.status === 'loading' ? <p className="mob-hint" role="status">{DenCopy.joinChecking}</p> : null}
      {look.status === 'bad' ? (
        <div className="den-j1__bad" role="alert">
          <p className="mob-note">{look.message}</p>
        </div>
      ) : null}
      {look.status === 'valid' && p ? (
        <>
          <div className="den-j1__preview" aria-label={`${DenCopy.joinPreviewName({ ...p, name: mobName })}, ${DenCopy.seatsTaken(taken)}`} role="group">
            <span className="den-j1__shapes" aria-hidden="true">
              {Array.from({ length: Math.min(5, taken) }, (_, i) => <FoldFigure key={i} fold={['dart', 'hexa', 'dogear', 'kandil', 'dart'][i]} size={52} locked />)}
              {taken < 5 ? <span className="den-j1__seat" /> : null}
            </span>
            <span className="den-j1__what"><b>{DenCopy.joinPreviewName({ ...p, name: mobName })}</b><span>{DenCopy.seatsTaken(taken)}</span></span>
          </div>
          <section className="den-sheet__section" aria-labelledby="den-j1-who">
            <h3 id="den-j1-who" className="den-sheet__h">{DenCopy.pickWho}</h3>
            <FoldPick folds={STARTER_FOLDS} value={fold} onChange={setFold} name="den-join-fold" compact />
          </section>
          <NameInput id={nameId} label={DenCopy.joinYourName} value={name} onChange={setName} error={nameError} />
          <p className="mob-hint">{DenCopy.joinPrivacy}</p>
          <button type="button" className="btn-volt md den-sheet__key" onClick={join} disabled={mob.busy === 'join'}>{mob.busy === 'join' ? DenCopy.joining : DenCopy.joinKey(mobName)}</button>
          <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
        </>
      ) : null}
    </MobDialog>
  );
}

/** Opened from an invite's "Start your Mob" (/mob?setup=1): the setup straight away, once the explainer was seen. */
function wantsSetup() {
  if (typeof window === 'undefined') return false;
  try { return new URLSearchParams(window.location.search).get('setup') === '1'; } catch { return false; }
}

/** D0. No Mob yet. billingOn: the server's PLAY_BILLING_ENABLED (slide 3 of the explainer says the plan rule only then). */
export default function DenStart({ user, mob, billingOn = false }) {
  const router = useRouter();
  const subjects = useMemo(() => subjectsFrom(user), [user]);
  const [sheet, setSheet] = useState(null);
  const [flow, setFlow] = useState(() => (subjects.length && user?.id && explainerSeen(user.id) && wantsSetup() ? { mode: 'start', screen: 'setup' } : null));
  const userId = user?.id || null;
  // The Fold this student already sits as (from an earlier Mob), so the setup skips "Who will you be?" (D168). Until the
  // read answers, or if it fails, the setup asks.
  const [seatFold, setSeatFold] = useState(null);
  useEffect(() => {
    let alive = true;
    mobFetch('/api/mob/shelf').then((r) => { if (alive && r.ok && typeof r.data?.seat?.fold === 'string') setSeatFold(r.data.seat.fold); });
    return () => { alive = false; };
  }, []);
  const open = (mode) => {
    // The first Start or Join on this device and account plays the explainer; after that they go straight on.
    if (userId && explainerSeen(userId)) { if (mode === 'join') setSheet('join'); else setFlow({ mode: 'start', screen: 'setup' }); return; }
    setFlow({ mode, screen: 'explainer' });
  };
  const closeFlow = (dest) => {
    setFlow(null);
    if (dest === 'join') setSheet('join');
    else if (dest === 'subjects') router.push(SUBJECTS_HREF);
  };
  return (
    <div className="den den--start">
      <DenStage previewFold="dart" previewName={DenCopy.you} />
      <p className="den-start__lead den-rise" style={{ '--d': '420ms' }}>{DenCopy.d0Lead}</p>
      {subjects.length ? (
        <div className="den-start__keys den-rise" style={{ '--d': '465ms' }}>
          <button type="button" className="btn-volt md den-key" data-page-primary="" onClick={() => open('start')}>{DenCopy.startMob}</button>
          <button type="button" className="mob-key den-key" onClick={() => open('join')}>{DenCopy.joinWithCode}</button>
        </div>
      ) : (
        <div className="den-start__keys den-rise" style={{ '--d': '465ms' }}>
          <p className="mob-note">{DenCopy.noSubjects}</p>
          <Link className="btn-volt md den-key" data-page-primary="" href={SUBJECTS_HREF}>{DenCopy.chooseSubjects}</Link>
          <button type="button" className="mob-key den-key" onClick={() => open('join')}>{DenCopy.joinWithCode}</button>
        </div>
      )}
      <p className="den-start__how den-rise" style={{ '--d': '510ms' }}>
        <button type="button" className="mob-link" data-explainer-replay="" onClick={() => setFlow({ mode: 'start', screen: 'explainer' })}>{EXPLAINER_COPY.link}</button>
      </p>
      {flow ? (
        <MobFlow mode={flow.mode} screen={flow.screen} userId={userId} billingOn={billingOn} subjects={subjects} seatFold={seatFold}
          suggestedName={suggestName(user?.name || '', user?.email || '')} run={mob.run} busy={mob.busy} onClose={closeFlow} />
      ) : null}
      {sheet === 'join' ? <JoinSheet open onClose={() => setSheet(null)} user={user} mob={mob} /> : null}
    </div>
  );
}
