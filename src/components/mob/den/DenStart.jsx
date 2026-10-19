"use client";
// No Mob yet, on the web, when the server offers v3 (MOB-BUILD-SPEC-V3 5.3 D0, D0a, J1).
//   D0: the lamp-lit room with your starter Fold and four dashed seats, the lead, "Start a Mob" and "Join with a code".
//   D0a: a name from the kind list (six at a time), the subject, the Fold, your first name, a colour, then "Start <name>".
//   J1: six boxes (eight for an old code; a pasted link works), a preview with no names, the Fold, the name, then join.
// Sharing inside the Mob is said before anyone starts or joins. Nothing is shown as done before the server answers.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { resolveSubject } from '@/../data/subject_registry';
import { checkName, suggestName } from '@/lib/mob/model.mjs';
import { MOB_NAMES } from '@/lib/mob/names.mjs';
import { DenCopy, denError } from '@/lib/mob/v3/denCopy.mjs';
import { STARTER_FOLDS, joinBoxes, parseJoinInput } from '@/lib/mob/v3/denModel.mjs';
import { MobDialog } from '../MobDialog';
import { mobFetch } from '../useMob';
import { DenStage } from './DenStage';
import { FoldFigure } from './FoldFigure';
import { FoldPick, NameChips } from './DenSheets';
import { SUBJECTS_HREF } from './denRoutes';
import './den.css';

const COLOUR_NAMES = ['Teal', 'Sky', 'Violet', 'Rose', 'Amber', 'Green', 'Coral', 'Slate'];

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

function Colours({ value, onChange, name }) {
  return (
    <fieldset className="mob-colours">
      <legend className="mob-label">{DenCopy.colourLabel}</legend>
      <div className="mob-colours__row">
        {COLOUR_NAMES.map((label, i) => (
          <label key={label} className="mob-colour" title={label}>
            <input type="radio" name={name} value={i} checked={value === i} onChange={() => onChange(i)} />
            <span className="mob-disc mob-disc--pick" data-colour={i} aria-hidden="true">{value === i ? <Check size={16} strokeWidth={2.5} /> : null}</span>
            <span className="sr-only">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
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

/** D0a. Start a Mob. */
function StartSheet({ open, onClose, user, mob, fold, setFold }) {
  const subjects = useMemo(() => subjectsFrom(user), [user]);
  const [nameKey, setNameKey] = useState(0);
  const [subject, setSubject] = useState(() => subjects[0]?.id || '');
  const [name, setName] = useState(() => suggestName(user?.name || '', user?.email || ''));
  const [colour, setColour] = useState(0);
  const [error, setError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const nameId = useId();
  const start = async () => {
    setError(null);
    const checked = checkName(name);
    if (!checked.ok) { setNameError(DenCopy.nameRule); return; }
    setNameError(null);
    const r = await mob.run('/api/mob', { subject, name: checked.name, colour, nameKey, fold }, { name: 'create' });
    if (!r.ok) {
      if (r.code?.startsWith('NAME') && r.code !== 'NAME_KEY_INVALID') setNameError(r.message);
      else setError(denError(r));
      return;
    }
    onClose();
  };
  return (
    <MobDialog open={open} onClose={onClose} title={DenCopy.startMob} labelId="den-d0a-h">
      <section className="den-sheet__section" aria-labelledby="den-d0a-name">
        <h3 id="den-d0a-name" className="den-sheet__h">{DenCopy.pickName}</h3>
        <NameChips value={nameKey} onChange={setNameKey} name="den-start-name" />
      </section>
      <section className="den-sheet__section" aria-labelledby="den-d0a-subject">
        <h3 id="den-d0a-subject" className="den-sheet__h">{DenCopy.subjectYouPlay}</h3>
        <div className="den-chips" role="radiogroup" aria-labelledby="den-d0a-subject">
          {subjects.map((s) => (
            <label key={s.id} className="den-chipopt">
              <input type="radio" name="den-start-subject" value={s.id} checked={subject === s.id} onChange={() => setSubject(s.id)} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="den-sheet__section" aria-labelledby="den-d0a-fold">
        <h3 id="den-d0a-fold" className="den-sheet__h">{DenCopy.pickFold}</h3>
        <FoldPick folds={STARTER_FOLDS} value={fold} onChange={setFold} name="den-start-fold" />
      </section>
      <NameInput id={nameId} label={DenCopy.nameLabel} value={name} onChange={setName} error={nameError} />
      <Colours value={colour} onChange={setColour} name="den-start-colour" />
      <p className="mob-hint">{DenCopy.marksNote}</p>
      <div className="den-sheet__foot den-sheet__foot--key">
        <button type="button" className="btn-volt md den-sheet__key" onClick={start} disabled={mob.busy === 'create' || !subject}>
          {mob.busy === 'create' ? DenCopy.starting : DenCopy.startKey(MOB_NAMES[nameKey] || '')}
        </button>
        <p className="mob-hint den-center">{DenCopy.startNext}</p>
      </div>
      <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
    </MobDialog>
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

/** D0. No Mob yet. */
export default function DenStart({ user, mob }) {
  const subjects = useMemo(() => subjectsFrom(user), [user]);
  const [sheet, setSheet] = useState(null);
  const [fold, setFold] = useState('dart');
  return (
    <div className="den den--start">
      <DenStage previewFold={fold} previewName={DenCopy.you} />
      <p className="den-start__lead den-rise" style={{ '--d': '420ms' }}>{DenCopy.d0Lead}</p>
      {subjects.length ? (
        <div className="den-start__keys den-rise" style={{ '--d': '465ms' }}>
          <button type="button" className="btn-volt md den-key" data-page-primary="" onClick={() => setSheet('start')}>{DenCopy.startMob}</button>
          <button type="button" className="mob-key den-key" onClick={() => setSheet('join')}>{DenCopy.joinWithCode}</button>
        </div>
      ) : (
        <div className="den-start__keys den-rise" style={{ '--d': '465ms' }}>
          <p className="mob-note">{DenCopy.noSubjects}</p>
          <Link className="btn-volt md den-key" data-page-primary="" href={SUBJECTS_HREF}>{DenCopy.chooseSubjects}</Link>
          <button type="button" className="mob-key den-key" onClick={() => setSheet('join')}>{DenCopy.joinWithCode}</button>
        </div>
      )}
      {sheet === 'start' ? <StartSheet open onClose={() => setSheet(null)} user={user} mob={mob} fold={fold} setFold={setFold} /> : null}
      {sheet === 'join' ? <JoinSheet open onClose={() => setSheet(null)} user={user} mob={mob} /> : null}
    </div>
  );
}
