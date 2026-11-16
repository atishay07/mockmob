"use client";

// "Bring a mistake from any test" (16 Nov 2026), drawn inside Ask Mobi's own surface: the docked panel, the overlay, the phone
// sheet and the /mentor page. The words, the request rules, the reply contract and the state mapping are in
// src/services/mobi/bringMistake.mjs (pure, tested); the server is POST /api/ai/mentor/mistake.
//
//  * MistakeDoor: the one quiet door, "Got one wrong in another test? Paste it here.", with its price said before the tap.
//  * BringMistake: the form (the question with its options, counted to 1,500; the answer chosen and the right answer, both
//    optional; the subject, the student's own), the price before sending and the one volt key. Then the answer, drawn only
//    once the server has answered and the answer has passed the contract again here: what it tests, why the answer is what
//    it is (or that Mobi is not sure), the likely slip, and 2 checks answered in place with the home sample's option grammar.
//
// States: idle, typing (the count), sending, answered, failed (Try again, a new request), unknown (Try again, the SAME request,
// so it can never be charged twice), over this month's AI limit, no credits, paused, offline, refused (not a test question)
// and the fixed support reply. Nothing is shown as answered before the server says so.
//
// A photo of the question (lane web/1116-photo, 16 Nov 2026; switch data/mistake_photo.mjs): one key above the text box opens
// the phone's camera or gallery (no `capture`). The photo is made ready here (mistakePhoto.js: upright, at most 1,600 px, a JPEG
// of at most 900 KB; the original is never uploaded), then shown as a thumbnail with its size, Change photo and Remove; its row
// is drawn as soon as a file is chosen, so nothing jumps when the thumbnail arrives. With a photo the text box is an optional
// note (300) and the price line says a photo uses 2 credits. The answer shows what Mobi read from the photo under Your question.
// Without a photo everything is as it was.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Camera, Check, X } from 'lucide-react';
import MobiMark from './MobiMark';
import { needsSupport, SUPPORT_REPLY } from '@/services/ai/supportCheck';
import { usedLine } from '@/lib/creditCopy.mjs';
import {
  MISTAKE_COPY, MISTAKE_CREDITS, MISTAKE_LIMITS, MISTAKE_PHOTO_CREDITS, MISTAKE_PHOTO_LIMITS, MISTAKE_PHOTO_ON, checksTally, cleanText,
  countLine, mistakeOutcome, mistakeSubjects, nextStep, optionState, priceLine, verdictLine,
} from '@/services/mobi/bringMistake.mjs';
import { preparePhoto, kilobytes } from './mistakePhoto';
import './bring-mistake.css';

// The development preview (/preview/arena &photo=off) can show the form with the photo switch off. It can only turn photos
// off, never on.
const previewPhotoOff = () => typeof window !== 'undefined' && window.__mmPreviewMistakePhotoOff === true;

const LETTERS = 'ABCD';
// The model has 35 s; the route's own reads sit around it. A reply later than this is an unknown outcome: Try again sends the
// same request, which the server answers from what it stored (never a second charge).
const SEND_TIMEOUT_MS = 60_000;
const newRequestId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`);

async function postMistake(payload) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, SEND_TIMEOUT_MS);
  try {
    const res = await fetch('/api/ai/mentor/mistake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const body = await res.json().catch(() => null);
    return timedOut ? { kind: 'timeout' } : { kind: 'response', res: { ok: res.ok, status: res.status }, body };
  } catch {
    return { kind: timedOut ? 'timeout' : 'network' };
  } finally { clearTimeout(timer); }
}

/** The one quiet door into the form. Its price is said on it, before the tap. */
export function MistakeDoor({ onOpen, variant = 'panel' }) {
  return (
    <button type="button" className="bm-door" data-variant={variant} onClick={onOpen}>
      <span className="bm-door__text">{MISTAKE_COPY.door}</span>
      <em className="bm-door__price">{MISTAKE_COPY.doorPrice}</em>
    </button>
  );
}

function CheckBlock({ check, i, n, picked, onPick }) {
  const stemId = useId();
  const answered = Number.isInteger(picked);
  const verdict = verdictLine(check, picked);
  return (
    <fieldset className="bm-q" data-answered={answered || undefined}>
      <legend className="bm-q__n">{MISTAKE_COPY.questionOf(i + 1, n)}</legend>
      <p className="bm-q__stem" id={stemId}>{check.question}</p>
      <div className="bm-opts" role="group" aria-labelledby={stemId}>
        {check.options.map((text, index) => {
          const state = optionState({ picked, answer: check.answer, index });
          return (
            <button
              key={index} type="button" className="bm-opt" data-state={state} disabled={answered}
              aria-pressed={answered ? index === picked : false} onClick={() => onPick(index)}
            >
              <span className="bm-opt__key" aria-hidden="true">{LETTERS[index]}</span>
              <span className="bm-opt__text">{text}</span>
              {state === 'correct' ? <Check className="bm-opt__mark" size={18} strokeWidth={2.6} aria-hidden="true" /> : null}
              {state === 'wrong' ? <X className="bm-opt__mark" size={18} strokeWidth={2.6} aria-hidden="true" /> : null}
              {state === 'correct' ? <span className="sr-only">, the right answer</span> : state === 'wrong' ? <span className="sr-only">, your pick</span> : null}
            </button>
          );
        })}
      </div>
      <div className="bm-q__foot" aria-live="polite">
        {answered ? (
          <div className="bm-why">
            <p className="bm-verdict" data-right={picked === check.answer || undefined}>{verdict}</p>
            <p className="bm-reason">{check.reason}</p>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function Answer({ answer, wallet, onLeave, onAnother, headRef }) {
  const { mistake, subject, question, chosen, charged, replayed, credits } = answer;
  const [picks, setPicks] = useState([null, null]);
  const tally = checksTally(mistake.checks, picks);
  const next = nextStep(subject, mistake.chapter);
  const spent = replayed && !charged ? MISTAKE_COPY.replayedCharge(credits)
    : charged ? usedLine({ cost: charged, pool: 'ai', balance: wallet?.known ? wallet.total : null }) : 'No credit used.';
  return (
    <article className="bm-answer amb-rise" aria-labelledby="bm-tests">
      <figure className="amb-quote bm-quote">
        <figcaption>{MISTAKE_COPY.yourQuestion}{subject?.name ? `, ${subject.name}` : ''}</figcaption>
        {/* A photo: what Mobi read from it, so a misreading shows at once. */}
        {mistake.read ? <span className="bm-quote__read">{MISTAKE_COPY.photoRead}</span> : null}
        <p data-read={mistake.read ? '' : undefined}>{mistake.read || question}</p>
        {chosen ? <span className="bm-quote__pick">You chose <b>{chosen}</b></span> : null}
      </figure>

      <section className="bm-part">
        <h3 id="bm-tests" tabIndex={-1} ref={headRef}>{MISTAKE_COPY.tests}</h3>
        <p>{mistake.tests}</p>
      </section>
      <section className="bm-part">
        <h3>{MISTAKE_COPY.why}</h3>
        {mistake.answer.sure
          ? <p className="bm-key">{MISTAKE_COPY.answerIs(mistake.answer.text)}</p>
          : <p className="bm-unsure">{MISTAKE_COPY.notSure}</p>}
        <p>{mistake.why}</p>
      </section>
      {mistake.slip ? (
        <section className="bm-part">
          <h3>{MISTAKE_COPY.slip}</h3>
          <p>{mistake.slip}</p>
        </section>
      ) : null}

      <section className="bm-checks" aria-labelledby="bm-checks-title">
        <h3 id="bm-checks-title">{MISTAKE_COPY.checksTitle}</h3>
        <p className="bm-honest">{MISTAKE_COPY.honesty}</p>
        {mistake.checks.map((check, i) => (
          <CheckBlock key={i} check={check} i={i} n={mistake.checks.length} picked={picks[i]} onPick={(index) => setPicks((prev) => prev.map((p, j) => (j === i && !Number.isInteger(p) ? index : p)))} />
        ))}
        {tally ? <p className="bm-tally" role="status">{tally}</p> : null}
      </section>

      <p className="bm-next">
        <Link href={next.href} className="amb-link bm-next__link" onClick={onLeave}>{next.label}</Link>
        <span className="bm-next__from">{MISTAKE_COPY.bank}</span>
      </p>
      <span className="amb-src"><MobiMark size={15} />Written reply. {spent}</span>
      <button type="button" className="amb-btn amb-btn--line bm-another" onClick={onAnother}>{MISTAKE_COPY.another}</button>
    </article>
  );
}

/**
 * The form and its answer. `wallet`/`paid` are the panel's (paidState); `form` is the panel's form ('dock' | 'overlay' |
 * 'sheet' | 'page'). `onSpent` reads the wallet again after any answer; `onPending(bool)` lets the page's Mobi think.
 */
export default function BringMistake({ user, wallet, paid, offline, form = 'dock', onBack = null, onSpent = null, onPending = null, onLeave = null }) {
  const subjects = useMemo(() => mistakeSubjects(user?.subjects), [user?.subjects]);
  const [question, setQuestion] = useState('');
  const [chosen, setChosen] = useState('');
  const [key, setKey] = useState('');
  const [subject, setSubject] = useState(subjects[0]?.id || '');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [answer, setAnswer] = useState(null);
  // The switch, as this page was built; the server's own "photos are off" turns it off here too (a switch flipped since).
  const [photoOn, setPhotoOn] = useState(() => MISTAKE_PHOTO_ON && !previewPhotoOff());
  // The photo: null, { state: 'preparing' } while it is made ready, or { state: 'ready', data, bytes, width, height, url }.
  const [photo, setPhoto] = useState(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const photoUrl = useRef(null);
  const photoTurn = useRef(0);
  const fileRef = useRef(null);
  const photoKeyRef = useRef(null);
  const changeRef = useRef(null);
  const focusAfterPhoto = useRef(null);
  const pendingRef = useRef(null);
  const inFlight = useRef(false);
  const rootRef = useRef(null);
  const titleRef = useRef(null);
  const fieldRef = useRef(null);
  const headRef = useRef(null);
  const ids = { q: useId(), count: useId(), photos: useId(), chosen: useId(), key: useId(), subject: useId(), price: useId(), privacy: useId(), photoMeta: useId(), photoError: useId() };
  // One volt key per view: the docked panel and the overlay sit outside the page (#app-main), beside the sidebar's lime Start
  // key. While the form's key is on screen, a marker in the page says the view owns its primary (the shell's own data-owns-start
  // contract, AppLayoutClient), so that Start key steps back. The phone sheet covers the dock itself; the page form marks its key.
  const [shellMain] = useState(() => (typeof document !== 'undefined' && (form === 'dock' || form === 'overlay') ? document.getElementById('app-main') : null));

  // On a phone the form opens without the keyboard (focus on its title); with a mouse the question box takes focus at once.
  useEffect(() => {
    let fine = false;
    try { fine = window.matchMedia('(pointer: fine)').matches; } catch { fine = false; }
    (fine && form !== 'sheet' ? fieldRef.current : titleRef.current)?.focus({ preventScroll: true });
  }, [form]);

  // The phone's keyboard: the sheet sits on the visible part of the screen (the visual viewport), so the send key at its foot
  // is never under the keyboard. Only the sheet moves; the page and the docked panel scroll as they always did.
  useLayoutEffect(() => {
    if (form !== 'sheet') return undefined;
    const sheet = rootRef.current?.closest('.amb-panel--sheet');
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!sheet || !vv) return undefined;
    const update = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      sheet.style.setProperty('--amb-kb', `${kb}px`);
      sheet.style.setProperty('--amb-vh', `${Math.round(vv.height)}px`);
      sheet.toggleAttribute('data-keyboard', kb > 80);
      // The field being typed in stays in the shorter body, above the key.
      const active = document.activeElement;
      if (kb > 80 && active && rootRef.current?.contains(active) && /^(TEXTAREA|INPUT|SELECT)$/.test(active.tagName)) {
        window.requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest' }));
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      sheet.style.removeProperty('--amb-kb');
      sheet.style.removeProperty('--amb-vh');
      sheet.removeAttribute('data-keyboard');
    };
  }, [form]);

  useEffect(() => { onPending?.(sending); }, [sending, onPending]);
  useEffect(() => () => onPending?.(false), [onPending]);
  // The thumbnail's object URL lives until the photo is removed or changed, or the form goes.
  useEffect(() => () => { if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); }, []);
  // After a pick or a removal the key that started it has gone: focus goes to the photo's own next control.
  useEffect(() => {
    const target = focusAfterPhoto.current;
    if (!target) return;
    focusAfterPhoto.current = null;
    (target === 'change' ? changeRef.current : photoKeyRef.current)?.focus({ preventScroll: true });
  }, [photo]);

  useEffect(() => {
    if (!answer) return;
    let reduced = false;
    try { reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { reduced = true; }
    headRef.current?.focus({ preventScroll: true });
    // In the panel the answer is the body's first thing: the body goes back to its top. On the page, the answer comes into view
    // under the top bar (its scroll-margin).
    if (form === 'page') rootRef.current?.querySelector('.bm-answer')?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    else rootRef.current?.querySelector('.bm-body')?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [answer, form]);

  const typed = question.trim();
  const photoReady = photo?.state === 'ready';
  const preparing = photo?.state === 'preparing';
  // With a photo the box is a short note for what the photo does not show; without one it is the question, as before.
  const boxMax = photo ? MISTAKE_PHOTO_LIMITS.note : MISTAKE_LIMITS.question;
  // As the server checks: the words as typed and as cleaned, so an invisible character cannot split a phrase.
  const distress = [question, chosen, key].some((t) => needsSupport(t) || needsSupport(cleanText(t)));
  const held = notice?.state === 'unknown'; // a request whose outcome is not known: only Try again (the same request) goes out
  const stopped = notice?.state === 'over';
  const asked = photoReady || (!photo && Boolean(typed));
  const canSend = asked && question.length <= boxMax && !preparing && !sending && !held && !stopped
    && (distress || (paid?.open && !offline));
  const balance = wallet?.known && Number.isFinite(wallet.total) ? wallet.total : null;
  // The line before sending says what sending does: free for the support reply, nothing at all past this month's AI limit (the
  // notice above says why), else the price with the balance (both prices once a photo is chosen), or why written answers wait.
  const price = priceLine(balance, { photo: Boolean(photo) });
  const priceWords = distress ? MISTAKE_COPY.free
    : stopped ? MISTAKE_COPY.recordFree
      : offline ? MISTAKE_COPY.offline : paid?.open ? price : paid?.why || price;
  const noCredits = Boolean(wallet?.known) && Number.isFinite(wallet?.total) && wallet.total <= 0;
  const locked = sending || held;

  function clearPhoto() {
    photoTurn.current += 1;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
    setPhoto(null);
  }

  // A chosen file: its row is drawn at once (reserved), then the photo is made ready in it. A file the browser cannot open, or
  // one too large even made smaller, leaves no photo and says so; nothing has been sent or charged.
  async function choosePhoto(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = ''; // the same file can be chosen again
    if (!file || locked) return;
    const turn = photoTurn.current + 1;
    photoTurn.current = turn;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
    setPhoto({ state: 'preparing' });
    setPhotoError(null);
    if (notice && notice.state !== 'unknown' && notice.state !== 'over') setNotice(null);
    try {
      const ready = await preparePhoto(file);
      if (photoTurn.current !== turn) { URL.revokeObjectURL(ready.url); return; }
      photoUrl.current = ready.url;
      focusAfterPhoto.current = 'change';
      setPhoto({ state: 'ready', ...ready });
    } catch (err) {
      if (photoTurn.current !== turn) return;
      focusAfterPhoto.current = 'key';
      setPhoto(null);
      // Said under the photo key, where the student just was, not at the foot of the form.
      setPhotoError(err?.reason === 'too_big' ? MISTAKE_COPY.photoTooBig : MISTAKE_COPY.photoBadFile);
    }
  }

  function removePhoto() {
    setPhotoError(null);
    focusAfterPhoto.current = 'key';
    clearPhoto();
    if (notice && notice.state !== 'unknown' && notice.state !== 'over') setNotice(null);
  }

  async function send({ again = false } = {}) {
    if (inFlight.current) return;
    if (!again) {
      if (!asked || preparing) return;
      // Words that sound like distress: the support reply, free, offline too (the server answers it too, before anything else).
      if (distress && offline) { setNotice({ state: 'support', reply: SUPPORT_REPLY }); return; }
      if (!distress && (!paid?.open || offline)) return;
      const payload = { question, chosen: chosen.trim() || null, key: key.trim() || null, subject };
      // The prepared JPEG only (never the original file), and only with the switch on.
      if (photoReady && photoOn) payload.photo = { mime: 'image/jpeg', data: photo.data };
      pendingRef.current = { id: newRequestId(), payload, credits: payload.photo ? MISTAKE_PHOTO_CREDITS : MISTAKE_CREDITS };
    }
    if (!pendingRef.current) return;
    inFlight.current = true;
    const sent = pendingRef.current;
    setSendingPhoto(Boolean(sent.payload.photo));
    setSending(true);
    setNotice(null);
    let plan;
    try {
      plan = mistakeOutcome(await postMistake({ ...sent.payload, requestId: sent.id }), { credits: sent.credits });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
    // The wallet is read again after every definite or unknown outcome, so the balance shown is the one stored.
    onSpent?.();
    if (plan.state === 'unknown') { setNotice(plan); return; }
    pendingRef.current = null;
    if (plan.state === 'answered') {
      const picked = subjects.find((s) => s.id === sent.payload.subject) || subjects[0] || null;
      setAnswer({ mistake: plan.mistake, charged: plan.charged, replayed: plan.replayed, credits: sent.credits, subject: picked, question: sent.payload.question.trim(), chosen: sent.payload.chosen });
      return;
    }
    if (plan.photoOff) { setPhotoOn(false); clearPhoto(); }
    setNotice(plan);
  }

  function another() {
    setAnswer(null);
    setQuestion(''); setChosen(''); setKey('');
    clearPhoto();
    setNotice(null);
    window.requestAnimationFrame(() => (titleRef.current || fieldRef.current)?.focus({ preventScroll: false }));
  }

  if (answer) {
    return (
      <div className="bm" data-form={form} ref={rootRef}>
        <div className="amb-body bm-body">
          <h3 className="sr-only" tabIndex={-1} ref={titleRef}>{MISTAKE_COPY.title}</h3>
          <Answer answer={answer} wallet={wallet} onLeave={onLeave} onAnother={another} headRef={headRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="bm" data-form={form} ref={rootRef}>
      {shellMain ? createPortal(<span hidden data-owns-start="" />, shellMain) : null}
      <form className="bm-form" aria-labelledby="bm-title" onSubmit={(event) => { event.preventDefault(); send(); }} noValidate>
        <div className="amb-body bm-body">
          <div className="bm-head">
            <h3 id="bm-title" className="bm-title" tabIndex={-1} ref={titleRef}>{MISTAKE_COPY.title}</h3>
            {onBack ? <button type="button" className="bm-back" onClick={onBack} disabled={sending}>{MISTAKE_COPY.back}</button> : null}
          </div>
          <p className="bm-lead">{MISTAKE_COPY.lead}</p>

          {photoOn ? (
            <div className="bm-field bm-photo-field">
              {/* No `capture`: a phone offers its camera or its gallery. The input is drawn off screen; the key opens it. */}
              <input ref={fileRef} type="file" accept="image/*" className="bm-file" tabIndex={-1} aria-hidden="true" onChange={choosePhoto} />
              {photo ? (
                <div className="bm-photo" data-state={photo.state} aria-busy={preparing || undefined}>
                  <span className="bm-photo__thumb">
                    {/* A blob: URL of the photo made ready in this browser; nothing for the image optimiser to fetch. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photoReady ? <img src={photo.url} alt={MISTAKE_COPY.photoAlt} width={88} height={88} /> : <MobiMark size={22} blinking />}
                  </span>
                  <span className="bm-photo__side">
                    <span className="bm-photo__meta" id={ids.photoMeta} role="status">{photoReady ? MISTAKE_COPY.photoSize(kilobytes(photo.bytes)) : MISTAKE_COPY.photoPreparing}</span>
                    <span className="bm-photo__acts">
                      <button type="button" ref={changeRef} className="amb-btn amb-btn--line bm-photo__act" disabled={locked || preparing} aria-describedby={ids.photoMeta} onClick={() => fileRef.current?.click()}>{MISTAKE_COPY.photoChange}</button>
                      {/* The quieter of the two: a text key, 44 px tall, as the form's Back. */}
                      <button type="button" className="bm-photo__act bm-photo__remove" disabled={locked || preparing} aria-describedby={ids.photoMeta} onClick={removePhoto}>{MISTAKE_COPY.photoRemove}</button>
                    </span>
                  </span>
                </div>
              ) : (
                <button type="button" ref={photoKeyRef} className="bm-photo-key" disabled={locked} aria-describedby={photoError ? `${ids.photoError} ${ids.privacy}` : ids.privacy} onClick={() => fileRef.current?.click()}>
                  <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>{MISTAKE_COPY.photoKey}</span>
                </button>
              )}
              {photoError ? <p className="bm-photo__error" id={ids.photoError} role="alert">{photoError}</p> : null}
              <p className="bm-photo__privacy" id={ids.privacy}>{MISTAKE_COPY.photoPrivacy}</p>
            </div>
          ) : null}

          <div className="bm-field">
            <label htmlFor={ids.q} className="bm-label">
              {photo ? <>{MISTAKE_COPY.noteLabel} <span>({MISTAKE_COPY.optional})</span></> : MISTAKE_COPY.questionLabel}
            </label>
            <textarea
              id={ids.q} ref={fieldRef} className="bm-input bm-input--q" data-note={photo ? '' : undefined} rows={photo ? 3 : 6} maxLength={boxMax} value={question}
              placeholder={photo ? MISTAKE_COPY.noteHint : MISTAKE_COPY.questionHint} disabled={sending || held}
              aria-describedby={photoOn ? ids.count : `${ids.photos} ${ids.count}`}
              onChange={(event) => { setQuestion(event.target.value); if (notice && notice.state !== 'unknown' && notice.state !== 'over') setNotice(null); }}
            />
            <div className="bm-under">
              {photoOn ? null : <span id={ids.photos}>{MISTAKE_COPY.photos}</span>}
              {/* A paste past the limit is cut by the box itself; the count says the box is full. With a photo the box is a
                  300-character note: words typed before the photo was added may be longer, and the count says so. */}
              <span id={ids.count} className="bm-count" data-full={question.length >= boxMax || undefined}>
                {countLine(question.length, boxMax)}{question.length > boxMax ? `, ${MISTAKE_COPY.noteOver}` : question.length >= boxMax ? `, ${MISTAKE_COPY.full}` : ''}
              </span>
            </div>
          </div>

          {/* tabIndex 0 on the inputs and the select: the overlay and sheet keep Tab inside the panel by the controls they list
              (AssistantDrawer: links, enabled buttons, textareas, [tabindex="0"]), so with the send key still off, Tab from the
              subject wraps to the top instead of leaving the dialog. */}
          <div className="bm-pair">
            <div className="bm-field">
              <label htmlFor={ids.chosen} className="bm-label">{MISTAKE_COPY.chosenLabel} <span>({MISTAKE_COPY.optional})</span></label>
              <input id={ids.chosen} className="bm-input" type="text" tabIndex={0} maxLength={MISTAKE_LIMITS.answer} value={chosen} disabled={sending || held} autoComplete="off" enterKeyHint="next" onChange={(event) => setChosen(event.target.value)} />
            </div>
            <div className="bm-field">
              <label htmlFor={ids.key} className="bm-label">{MISTAKE_COPY.keyLabel} <span>({MISTAKE_COPY.optional})</span></label>
              <input id={ids.key} className="bm-input" type="text" tabIndex={0} maxLength={MISTAKE_LIMITS.answer} value={key} disabled={sending || held} autoComplete="off" enterKeyHint="next" onChange={(event) => setKey(event.target.value)} />
            </div>
          </div>

          <div className="bm-field bm-field--subject">
            <label htmlFor={ids.subject} className="bm-label">{MISTAKE_COPY.subjectLabel}</label>
            <select id={ids.subject} className="bm-input bm-select" tabIndex={0} value={subject} disabled={sending || held} onChange={(event) => setSubject(event.target.value)}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {notice ? <Notice notice={notice} sending={sending} noCredits={noCredits} onRetry={() => send({ again: notice.state === 'unknown' })} onLeave={onLeave} /> : null}
        </div>

        <div className="bm-foot">
          {sending ? (
            <p className="amb-reading bm-reading" role="status"><MobiMark size={20} blinking />{sendingPhoto ? MISTAKE_COPY.sendingPhoto : MISTAKE_COPY.sending}</p>
          ) : (
            <p className="bm-price" id={ids.price} aria-live="polite">
              {priceWords}
              {!offline && !paid?.open && noCredits ? <> <Link href="/wallet" className="bm-price__link" onClick={onLeave}>{MISTAKE_COPY.seeCredits}</Link></> : null}
            </p>
          )}
          {/* The view's one volt key; on the page it steps the shell's Start key back (data-page-primary, U3). */}
          <button type="submit" className="btn-volt md bm-send" disabled={!canSend} aria-describedby={ids.price} aria-busy={sending || undefined} {...(form === 'page' ? { 'data-page-primary': '' } : {})}>{MISTAKE_COPY.send}</button>
        </div>
      </form>
    </div>
  );
}

function Notice({ notice, sending, noCredits, onRetry, onLeave }) {
  if (notice.state === 'support') {
    return <div className="amb-notice bm-notice" role="status" data-last=""><span>{notice.reply}</span></div>;
  }
  const retry = notice.state === 'failed' || notice.state === 'unknown';
  return (
    <div className="amb-notice bm-notice" role={notice.state === 'refused' ? 'status' : 'alert'} data-state={notice.state}>
      <span>{notice.message}</span>
      {retry ? <button type="button" className="amb-btn amb-btn--line" disabled={sending} onClick={onRetry}>{MISTAKE_COPY.tryAgain}</button> : null}
      {notice.state === 'blocked' && noCredits ? <Link href="/wallet" className="amb-btn amb-btn--line" onClick={onLeave}>{MISTAKE_COPY.seeCredits}</Link> : null}
    </div>
  );
}
