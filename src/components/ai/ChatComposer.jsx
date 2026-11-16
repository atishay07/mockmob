"use client";

// The composer of Ask Mobi's chat (16 Nov 2026; the owner, that evening: "I don't see any way to upload a photo here"). One
// calm container, always on screen: on the /mentor page it is pinned above the phone's dock and above the on-screen keyboard
// (the visual viewport decides, so it is never under either); in the docked panel, overlay and sheet it is the panel's foot.
//
//  * A textarea that grows from 1 line to about 6. Enter sends where there is a real keyboard and a doubt is being typed;
//    Shift+Enter makes a line; on a phone Enter makes a line and the send key sends. Ctrl or Cmd + Enter sends everywhere.
//  * A visible, labelled Photo key: camera or gallery on a phone, the file chooser on a desktop, and there also a drop onto
//    the composer or a paste of an image. The photo is made ready in the browser (mistakePhoto.js: upright, at most 1,600 px,
//    a JPEG of at most 900 KB; the original never leaves the device) and shown as a thumbnail with a remove key.
//  * What kind of ask: typed words are a doubt. A photo makes it "a question I got wrong". The small switch at the top opens
//    that kind for a typed or pasted question too, with what the mistake route takes: the subject, and behind one line, what
//    the student marked and the right answer if known. Every limit and every message of the old form is kept (BringMistake's
//    rules, src/services/mobi/bringMistake.mjs).
//  * Under the container, ONE quiet line that is true before a send: what this send uses and what is left (chatCopy.mjs
//    sendLine, from the product's own prices), and that Mobi is AI and can be wrong. No provider is named.
//
// The engine (AskMobiPanel.jsx) owns sending: `onSubmit()` for typed words, `onMistake(fields)` for a question brought from
// another test. This file owns only what is being composed.
import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Camera, Image as ImageIcon, X } from 'lucide-react';
import MobiMark from './MobiMark';
import { needsSupport } from '@/services/ai/supportCheck';
import { MISTAKE_COPY, MISTAKE_LIMITS, MISTAKE_PHOTO_LIMITS, cleanText, countLine } from '@/services/mobi/bringMistake.mjs';
import { haveLine } from '@/lib/creditCopy.mjs';
import { preparePhoto, kilobytes } from './mistakePhoto';
import { CHAT_COPY, canAfford, sendLine } from './chatCopy.mjs';

const TEXT_MAX = 1500;
const finePointer = () => { try { return window.matchMedia('(pointer: fine)').matches; } catch { return true; } };
const isImage = (file) => Boolean(file) && /^image\//.test(file.type || '');

const ChatComposer = forwardRef(function ChatComposer({
  form = 'page', value, onChange, onSubmit, onMistake, canSendText = false, busy = false, opening = false,
  price = null, wallet = null, paid = null, offline = false, followUp = false, question = false,
  placeholder = null, subjects = [], photoOn = false, mistakeOn = true, stopped = false, needsNet = false, onLeave = null,
  onGone = null,
}, ref) {
  const [kind, setKind] = useState('doubt');
  // The photo: null, { state: 'preparing' } while it is made ready, or { state: 'ready', data, bytes, width, height, url }.
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [chosen, setChosen] = useState('');
  const [key, setKey] = useState('');
  const [subject, setSubject] = useState(subjects[0]?.id || '');
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(false);
  const fieldRef = useRef(null);
  const takeRef = useRef(null);
  const chooseRef = useRef(null);
  const photoKeyRef = useRef(null);
  const rootRef = useRef(null);
  const photoTurn = useRef(0);
  const photoUrl = useRef(null);
  const ids = { field: useId(), line: useId(), count: useId(), privacy: useId(), error: useId(), chosen: useId(), key: useId(), subject: useId(), menu: useId() };

  const mistake = mistakeOn && kind === 'mistake';
  const photoReady = photo?.state === 'ready';
  const preparing = photo?.state === 'preparing';
  const boxMax = mistake ? (photo ? MISTAKE_PHOTO_LIMITS.note : MISTAKE_LIMITS.question) : TEXT_MAX;
  const typed = value.trim();
  // As the server checks: the words as typed and as cleaned, so an invisible character cannot split a phrase.
  const distress = [value, chosen, key].some((t) => needsSupport(t) || needsSupport(cleanText(t)));
  const asked = photoReady || (!photo && Boolean(typed));
  const affordable = canAfford({ kind: 'mistake', photo: Boolean(photo), wallet });
  const canSendMistake = asked && value.length <= boxMax && !preparing && !busy && !opening && !stopped
    && (distress || (paid?.open && affordable && !offline));
  const canSend = mistake ? canSendMistake : canSendText;
  const line = sendLine({ kind: mistake ? 'mistake' : 'doubt', photo: Boolean(photo), price, wallet, offline, followUp: followUp && !mistake, support: distress, question, stopped: stopped && mistake, needsNet });
  const have = line.tone === 'cost' && wallet?.known ? haveLine(wallet.total) : null;
  const lineHead = have && line.text.endsWith(have) ? line.text.slice(0, -have.length).trimEnd() : line.text;
  const balanceTick = /^(\D*)(\d[\d,]*)([\s\S]*)$/.exec(have || '');

  const grow = () => {
    const node = fieldRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 152)}px`;
  };
  useLayoutEffect(grow, [value, mistake, photo]);

  function clearPhoto() {
    photoTurn.current += 1;
    photoUrl.current = null;
    setPhoto(null);
  }
  // The thumbnail's object URL is the composer's until the photo is sent (then the thread shows it and owns it).
  const dropUrl = () => { if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); photoUrl.current = null; };
  useEffect(() => () => dropUrl(), []);

  // A chosen file: its row is drawn at once, then the photo is made ready in it. A file the browser cannot open, or one too
  // large even made smaller, leaves no photo and says so; nothing has been sent or charged.
  async function takeFile(file) {
    if (!file || busy || !photoOn || !mistakeOn) return;
    const turn = photoTurn.current + 1;
    photoTurn.current = turn;
    dropUrl();
    setKind('mistake');
    setPhoto({ state: 'preparing' });
    setPhotoError(null);
    setMenu(false);
    try {
      const ready = await preparePhoto(file);
      if (photoTurn.current !== turn) { URL.revokeObjectURL(ready.url); return; }
      photoUrl.current = ready.url;
      setPhoto({ state: 'ready', ...ready });
      if (finePointer()) fieldRef.current?.focus({ preventScroll: true });
    } catch (err) {
      if (photoTurn.current !== turn) return;
      setPhoto(null);
      setPhotoError(err?.reason === 'too_big' ? MISTAKE_COPY.photoTooBig : MISTAKE_COPY.photoBadFile);
      photoKeyRef.current?.focus({ preventScroll: true });
    }
  }
  const onFile = (event) => { const file = event.target.files?.[0] || null; event.target.value = ''; takeFile(file); };

  function removePhoto() {
    setPhotoError(null);
    dropUrl();
    clearPhoto();
    photoKeyRef.current?.focus({ preventScroll: true });
  }

  // The Photo key: a phone is offered its camera or its gallery in two plain rows; a desktop gets its file chooser at once.
  function openPhoto() {
    if (busy || !photoOn) return;
    if (finePointer()) { chooseRef.current?.click(); return; }
    setMenu((v) => !v);
  }
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (event) => { if (!rootRef.current?.querySelector('.ach-photomenu')?.contains(event.target) && !photoKeyRef.current?.contains(event.target)) setMenu(false); };
    const onKey = (event) => { if (event.key === 'Escape') { setMenu(false); photoKeyRef.current?.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  useImperativeHandle(ref, () => ({
    focus: () => fieldRef.current?.focus({ preventScroll: false }),
    doubt: () => { setKind('doubt'); window.requestAnimationFrame(() => fieldRef.current?.focus({ preventScroll: false })); },
    mistake: () => { if (mistakeOn) setKind('mistake'); window.requestAnimationFrame(() => fieldRef.current?.focus({ preventScroll: false })); },
    photo: () => { if (mistakeOn) setKind('mistake'); openPhoto(); photoKeyRef.current?.scrollIntoView?.({ block: 'nearest' }); },
    photoOff: () => { dropUrl(); clearPhoto(); },
  }));

  async function send() {
    if (!canSend) return;
    if (!mistake) { onSubmit?.(); return; }
    const fields = { question: value, chosen, key, subject, photo: photoReady ? { data: photo.data, url: photo.url, bytes: photo.bytes } : null };
    const left = await onMistake?.(fields);
    if (!left) return;
    // Sent: the thread shows the photo now, so its URL is the thread's; the composer starts clean, as a doubt.
    photoUrl.current = null;
    clearPhoto();
    setChosen(''); setKey(''); setMore(false); setPhotoError(null); setKind('doubt');
    onChange('');
    onGone?.();
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    const force = event.ctrlKey || event.metaKey;
    // A pasted question is many lines, and a phone's Enter is a line: only a typed doubt on a real keyboard sends on Enter.
    if (force || (!event.shiftKey && !mistake && finePointer())) { event.preventDefault(); send(); }
  }

  function onPaste(event) {
    const file = [...(event.clipboardData?.files || [])].find(isImage);
    if (!file || !photoOn || !mistakeOn) return;
    event.preventDefault();
    takeFile(file);
  }

  const dragProps = photoOn && mistakeOn ? {
    onDragOver: (event) => { if ([...(event.dataTransfer?.types || [])].includes('Files')) { event.preventDefault(); setDrag(true); } },
    onDragLeave: (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDrag(false); },
    onDrop: (event) => { const file = [...(event.dataTransfer?.files || [])].find(isImage); setDrag(false); if (file) { event.preventDefault(); takeFile(file); } },
  } : {};

  const hint = mistake ? (photo ? CHAT_COPY.fieldPhoto : CHAT_COPY.fieldMistake)
    : followUp ? CHAT_COPY.fieldFollowUp : placeholder || CHAT_COPY.field;
  const over = value.length > boxMax;
  const showCount = mistake && (over || value.length >= boxMax * 0.8);
  const locked = busy || opening;

  return (
    <div className="ach-foot" data-form={form} ref={rootRef}>
      <form
        className="ach-composer" data-kind={mistake ? 'mistake' : 'doubt'} data-typed={typed ? '' : undefined} data-drag={drag || undefined} data-busy={busy || undefined}
        aria-label={CHAT_COPY.fieldLabel} onSubmit={(event) => { event.preventDefault(); send(); }} noValidate {...dragProps}
      >
        {drag ? <span className="ach-drop" aria-hidden="true">{CHAT_COPY.photoDrop}</span> : null}

        {/* What kind of ask. The row opens once the student is writing (focus, words, a photo), so the resting composer is one calm box. */}
        {mistakeOn && !question ? (
          <div className="ach-kindrow">
            <div>
              <div className="ach-kind" role="group" aria-label={CHAT_COPY.kindLabel}>
                <button type="button" aria-pressed={!mistake} disabled={locked} onClick={() => { setKind('doubt'); fieldRef.current?.focus({ preventScroll: true }); }}>{CHAT_COPY.kindDoubt}</button>
                <button type="button" aria-pressed={mistake} disabled={locked} onClick={() => { setKind('mistake'); fieldRef.current?.focus({ preventScroll: true }); }}>{CHAT_COPY.kindMistake}</button>
              </div>
            </div>
          </div>
        ) : null}

        {followUp && !mistake ? <p className="ach-included">{CHAT_COPY.followUpIncluded}</p> : null}

        {photo ? (
          <div className="ach-attach" data-state={photo.state} aria-busy={preparing || undefined}>
            <span className="ach-attach__thumb">
              {/* A blob: URL of the photo made ready in this browser; nothing for the image optimiser to fetch. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photoReady ? <img src={photo.url} alt={CHAT_COPY.photoAlt} width={56} height={56} /> : <MobiMark size={20} blinking />}
              <button type="button" className="ach-attach__remove" disabled={locked || preparing} onClick={removePhoto} aria-label={CHAT_COPY.photoRemove}><X size={14} strokeWidth={2.6} aria-hidden="true" /></button>
            </span>
            <span className="ach-attach__side">
              <span className="ach-attach__meta" role="status">{photoReady ? MISTAKE_COPY.photoSize(kilobytes(photo.bytes)) : CHAT_COPY.photoPreparing}</span>
              <span className="ach-attach__privacy" id={ids.privacy}>{CHAT_COPY.photoPrivacy}</span>
            </span>
          </div>
        ) : null}
        {photoError ? <p className="ach-error" id={ids.error} role="alert">{photoError}</p> : null}

        <label htmlFor={ids.field} className="sr-only">{hint}</label>
        <textarea
          id={ids.field} ref={fieldRef} className="ach-field" rows={1} value={value} maxLength={boxMax} placeholder={hint}
          disabled={locked} enterKeyHint="enter" data-tall={mistake && !photo ? '' : undefined}
          aria-describedby={`${ids.line}${showCount ? ` ${ids.count}` : ''}${photo ? ` ${ids.privacy}` : ''}`}
          onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} onPaste={onPaste}
        />
        {showCount ? (
          <p className="ach-count" id={ids.count} data-full={value.length >= boxMax || undefined}>
            {countLine(value.length, boxMax)}{over ? `, ${MISTAKE_COPY.noteOver}` : value.length >= boxMax ? `, ${MISTAKE_COPY.full}` : ''}
          </p>
        ) : null}

        {mistake ? (
          <div className="ach-more">
            {more ? (
              <div className="ach-pair" data-one={photo && !chosen ? '' : undefined}>
                {photo && !chosen ? null : (
                <div className="ach-mini">
                  <label htmlFor={ids.chosen}>{CHAT_COPY.marked}</label>
                  <input id={ids.chosen} type="text" tabIndex={0} maxLength={MISTAKE_LIMITS.answer} value={chosen} disabled={locked} autoComplete="off" enterKeyHint="next" onChange={(event) => setChosen(event.target.value)} />
                </div>
                )}
                <div className="ach-mini">
                  <label htmlFor={ids.key}>{CHAT_COPY.key}</label>
                  <input id={ids.key} type="text" tabIndex={0} maxLength={MISTAKE_LIMITS.answer} value={key} disabled={locked} autoComplete="off" enterKeyHint="done" onChange={(event) => setKey(event.target.value)} />
                </div>
              </div>
            ) : null}
            <button type="button" className="ach-textkey" aria-expanded={more} disabled={locked} onClick={() => setMore((v) => !v)}>{more ? (photo && !chosen ? CHAT_COPY.moreClosePhoto : CHAT_COPY.moreClose) : photo ? CHAT_COPY.moreOpenPhoto : CHAT_COPY.moreOpen}</button>
          </div>
        ) : null}

        <div className="ach-bar">
          {photoOn && mistakeOn && !question ? (
            <span className="ach-photo">
              {/* Two inputs, drawn off screen: one asks the phone for its camera, one for its gallery or files. */}
              <input ref={takeRef} type="file" accept="image/*" capture="environment" className="ach-file" tabIndex={-1} aria-hidden="true" onChange={onFile} data-photo-input="take" />
              <input ref={chooseRef} type="file" accept="image/*" className="ach-file" tabIndex={-1} aria-hidden="true" onChange={onFile} data-photo-input="choose" />
              <button type="button" ref={photoKeyRef} className="ach-photokey" disabled={locked} aria-haspopup="menu" aria-expanded={menu} aria-controls={menu ? ids.menu : undefined} aria-label={CHAT_COPY.photoKeyLong} onClick={openPhoto}>
                <Camera size={19} strokeWidth={2.1} aria-hidden="true" /><span>{CHAT_COPY.photoKey}</span>
              </button>
              {menu ? (
                <span className="ach-photomenu" id={ids.menu} role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); takeRef.current?.click(); }}><Camera size={19} strokeWidth={2.1} aria-hidden="true" />{CHAT_COPY.photoTake}</button>
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); chooseRef.current?.click(); }}><ImageIcon size={19} strokeWidth={2.1} aria-hidden="true" />{CHAT_COPY.photoChoose}</button>
                </span>
              ) : null}
            </span>
          ) : null}
          {mistake && subjects.length ? (
            <span className="ach-subject">
              <label htmlFor={ids.subject} className="sr-only">{CHAT_COPY.subject}</label>
              <select id={ids.subject} tabIndex={0} value={subject} disabled={locked} onChange={(event) => setSubject(event.target.value)}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </span>
          ) : null}
          {/* The view's one volt key. On the page it steps the shell's own Start key back for the whole visit (data-page-primary). */}
          <button type="submit" className="ach-send" disabled={!canSend} aria-label={CHAT_COPY.send} aria-describedby={ids.line} aria-busy={busy || undefined} {...(form === 'page' ? { 'data-page-primary': '' } : {})}>
            <ArrowUp size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="ach-under">
        <p className="ach-line" id={ids.line} data-tone={line.tone} aria-live="polite">
          {lineHead}
          {have ? <> <Link href="/wallet" className="amb-cost__wallet ach-line__have" onClick={onLeave}>{balanceTick ? <>{balanceTick[1]}<b key={balanceTick[2]} className="amb-num">{balanceTick[2]}</b>{balanceTick[3]}</> : have}</Link></> : null}
          {line.credits ? <> <Link href="/wallet" className="ach-line__link" onClick={onLeave}>{CHAT_COPY.seeCredits}</Link></> : null}
        </p>
        <p className="ach-ai">{CHAT_COPY.aiNote}</p>
      </div>
    </div>
  );
});

export default ChatComposer;
