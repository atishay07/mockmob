"use client";
// The setup after "Start your Mob": one question per screen under a den that changes as the student answers (replaces the
// one long D0a sheet for creating a Mob). Who will you be? Name your Mob. Pick the subject you'll play. What should your Mob
// call you? Only the steps this student needs (D168/D169): a student who already sits as a Fold skips the first and sees
// "You play as <Fold>" with Change on the last; one CUET subject skips the subject step. It calls the same create endpoint with the same fields and checks as D0a (POST /api/mob { subject,
// name, colour, nameKey, fold }), says when it is busy, keeps every answer when the server refuses, and the den opens
// when the server has the Mob. Step dots show where the student is, never invented progress (T002); defaults come only
// from real context, visible and editable: the first subject and the first name (T001). Back steps back; Back on the
// first step returns to D0.
import { useEffect, useRef, useState } from 'react';
import { subjectArt, subjectArtSrc } from '@/../data/subject_art.mjs';
import { denError, foldName, FOLD_LINES } from '@/lib/mob/v3/denCopy.mjs';
import { STARTER_FOLDS } from '@/lib/mob/v3/denModel.mjs';
import { COLOUR_NAMES, SETUP_COPY, changeFold, initialSetup, isLastStep, nameNote, namesOnPage, pennantShowsSubject, setupBack, setupBody, setupKey, setupNext, stepOf } from './explainerModel.mjs';
import { buildSetupPreview } from './setupPreview';
import { E, foldHead, foldStill } from './motion';

const TICK = <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
const BACK = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>;

/**
 * subjects: [{ id, name }] (the student's own CUET subjects). suggestedName: the first name the D0a sheet offered.
 * run(path, body, opts) and busy: the Mob hook's. onExit(): back to D0. onCreated(): the server has the Mob.
 * seatFold: the Fold the student already sits as (the shelf's seat), or null. initial: answers to start from (the preview;
 * its `step` is a step id). reduced: reduced motion.
 */
function startState({ subjects, suggestedName, seatFold, initial }) {
  const base = initialSetup({ subjects, suggestedName, seatFold });
  const { step, ...rest } = initial || {};
  const at = typeof step === 'string' ? Math.max(0, base.steps.indexOf(step)) : 0;
  return { ...base, ...rest, at };
}

export function MobSetup({ subjects = [], suggestedName = '', seatFold = null, run, busy = null, onExit, onCreated, initial = null, reduced = false }) {
  const [st, setSt] = useState(() => startState({ subjects, suggestedName, seatFold, initial }));
  const [page, setPage] = useState(() => (Number.isInteger(initial?.nameKey) ? Math.floor(initial.nameKey / 6) : 0));
  const [error, setError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [dir, setDir] = useState(0);
  const preview = useRef(null);
  const previewApi = useRef(null);
  const pane = useRef(null);
  const busyCreate = busy === 'create';
  const subjectName = subjects.find((s) => s.id === st.subject)?.name || '';

  useEffect(() => {
    if (!preview.current) return undefined;
    const api = buildSetupPreview(preview.current, { reduced });
    previewApi.current = api;
    return () => { api.destroy(); previewApi.current = null; };
  }, [reduced]);
  const firstUpdate = useRef(true);
  useEffect(() => {
    previewApi.current?.update(st, { subjectName, showSubject: pennantShowsSubject(st), onYou: stepOf(st) === 'you', first: firstUpdate.current });
    firstUpdate.current = false;
  }, [st, subjectName, reduced]);

  // each step slides in from the side it came from, its parts rising one after another; focus goes to its question
  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    if (dir && !reduced) el.animate([{ opacity: 0, transform: `translateX(${28 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 300, easing: E.emph, fill: 'backwards' });
    else if (dir) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
    if (!reduced) [...el.children].forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 120 + i * 45, easing: E.emph, fill: 'backwards' }));
    if (dir) el.querySelector('.mx-pane__title')?.focus({ preventScroll: true });
  }, [st.at, st.steps.length, dir, reduced]);

  const set = (patch) => { setError(null); setSt((s) => ({ ...s, ...patch })); };
  const key = setupKey(st);
  const back = () => {
    if (busyCreate) return;
    const b = setupBack(st);
    if (b === 'exit') { onExit?.(); return; }
    setDir(-1); setError(null); setSt(b);
  };
  const forward = async () => {
    if (!key.enabled || busyCreate) return;
    if (!isLastStep(st) || (st.returnTo && stepOf(st) === 'fold')) { setDir(1); setSt(setupNext(st)); return; }
    const body = setupBody(st);
    if (!body) return;
    setError(null); setNameError(null);
    const r = await run('/api/mob', body, { name: 'create' });
    if (!r?.ok) {
      if (r?.code?.startsWith('NAME') && r.code !== 'NAME_KEY_INVALID') setNameError(r.message || SETUP_COPY.youRule);
      else setError(denError(r || {}));
      return;
    }
    onCreated?.(r);
  };

  const shown = namesOnPage(page);
  const note = nameError ? { text: nameError, bad: true } : nameNote(st.name);
  let body = null;
  const id = stepOf(st);
  if (id === 'fold') {
    body = (
      <>
        <h2 className="mx-pane__title" tabIndex={-1}>{SETUP_COPY.foldTitle}</h2>
        <p className="mx-pane__line">{SETUP_COPY.foldLine}</p>
        <div className="mx-fcards" role="group" aria-label={SETUP_COPY.pickFoldKey}>
          {STARTER_FOLDS.map((k) => (
            <button key={k} type="button" className="mx-fcard" aria-pressed={st.fold === k} aria-label={`${foldName(k)}. ${FOLD_LINES[k]}`}
              onClick={(e) => {
                const im = e.currentTarget.querySelector('.mx-fcard__img');
                if (!reduced && im) im.animate([{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) translateY(-8px) scale(1.06)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 420, easing: E.out });
                set({ fold: k });
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the Fold's own still, local */}
              <span className="mx-fcard__img"><img src={foldStill(k)} alt="" width={78} height={78} draggable={false} /></span>
              <span className="mx-fcard__nm">{foldName(k)}</span>
              <span className="mx-fcard__ln">{FOLD_LINES[k]}</span>
              <span className="mx-fcard__tick" aria-hidden="true">{TICK}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (id === 'name') {
    body = (
      <>
        <h2 className="mx-pane__title" tabIndex={-1}>{SETUP_COPY.nameTitle}</h2>
        <p className="mx-pane__line">{SETUP_COPY.nameLine}</p>
        <div className="mx-chips" role="group" aria-label={SETUP_COPY.pickNameKey}>
          {shown.names.map((n) => (
            <button key={n.key} type="button" className="mx-chip" aria-pressed={st.nameKey === n.key} onClick={() => set({ nameKey: n.key })}>{n.text}</button>
          ))}
        </div>
        <button type="button" className="mx-link" style={{ marginTop: 6 }} onClick={() => setPage((p) => p + 1)}>
          {shown.page === shown.pages - 1 ? SETUP_COPY.showFirstSix : SETUP_COPY.showSixMore}
        </button>
      </>
    );
  } else if (id === 'subject') {
    body = (
      <>
        <h2 className="mx-pane__title" tabIndex={-1}>{SETUP_COPY.subjectTitle}</h2>
        <p className="mx-pane__line">{SETUP_COPY.subjectLine}</p>
        <div className="mx-subjects" role="group" aria-label={SETUP_COPY.subjectTitle}>
          {subjects.map((s) => {
            const art = subjectArt(s.id);
            return (
              <button key={s.id} type="button" className="mx-chip mx-subject" aria-pressed={st.subject === s.id} onClick={() => set({ subject: s.id })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the subject's object, local */}
                {art ? <img src={subjectArtSrc(art, 256)} alt="" width={40} height={40} draggable={false} /> : null}
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <h2 className="mx-pane__title" tabIndex={-1}>{SETUP_COPY.youTitle}</h2>
        {st.seatFold && st.fold ? (
          <div className="mx-playas">
            {/* eslint-disable-next-line @next/next/no-img-element -- the Fold's head, local */}
            <img src={foldHead(st.fold)} alt="" width={32} height={32} draggable={false} />
            <span className="mx-playas__text">{SETUP_COPY.playAs(foldName(st.fold))}</span>
            <button type="button" className="mx-link" data-change-fold="" onClick={() => { setDir(-1); setSt(changeFold(st)); }}>{SETUP_COPY.change}</button>
          </div>
        ) : null}
        <label className="mx-field">
          <span className="mx-field__label">{SETUP_COPY.youLabel}</span>
          <input className="mx-input" value={st.name} maxLength={18} autoComplete="given-name" aria-describedby="mx-name-note" aria-invalid={note.bad || undefined}
            onChange={(e) => { setNameError(null); set({ name: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') forward(); }} />
        </label>
        <p id="mx-name-note" className={`mx-note${note.bad ? ' is-bad' : ''}`} style={{ marginTop: 6 }}>{note.text}</p>
        <p className="mx-field__label" style={{ marginTop: 14 }} id="mx-colour-h">{SETUP_COPY.colour}</p>
        <div className="mx-swatches" role="group" aria-labelledby="mx-colour-h">
          {COLOUR_NAMES.map((label, i) => (
            <button key={label} type="button" className="mx-sw" data-colour={i} aria-label={label} aria-pressed={st.colour === i} onClick={() => set({ colour: i })} />
          ))}
        </div>
        <p className="mx-note" style={{ marginTop: 14 }}>{SETUP_COPY.marks}</p>
      </>
    );
  }
  const keyLabel = busyCreate ? SETUP_COPY.starting : key.label;
  return (
    <>
      <div className="mx-setbar">
        <button type="button" className="mx-iconbtn" aria-label={SETUP_COPY.back} onClick={back} disabled={busyCreate}>{BACK}</button>
        <div className="mx-steps" aria-hidden="true">
          {st.steps.map((k, i) => <span key={k} className={`mx-dot${i === st.at ? ' is-on' : ''}`} />)}
        </div>
        <span className="mx-sr">{`Step ${st.at + 1} of ${st.steps.length}`}</span>
      </div>
      <div ref={preview} className="mx-preview" aria-hidden="true" />
      <div className="mx-panes">
        <div ref={pane} key={id} className="mx-pane" data-step={id}>{body}</div>
      </div>
      <div className="mx-setfoot">
        {error ? <p className="mx-seterr" role="alert">{error}</p> : <p className="mx-setunder">{id === 'you' ? SETUP_COPY.under : ''}</p>}
        <button type="button" className="mx-key" data-setup-key="" onClick={forward} disabled={!key.enabled} aria-busy={busyCreate || undefined}>{keyLabel}</button>
      </div>
    </>
  );
}

export default MobSetup;
