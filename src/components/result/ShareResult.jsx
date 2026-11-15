"use client";

// Share your result (F-C, 15 Nov 2026): one quiet key under the result's front opens a sheet with a picture of this set,
// 1080 x 1350, drawn here in the browser on a canvas. Never a server image route: the Next.js in use has an open advisory
// on server-drawn share images that take request values. The picture's lines: shareCardModel.mjs.
//
// The sheet is the product's own (the Report sheet's frame, ReportSheet.jsx and pro-nudge.css): a native modal <dialog>, a
// bottom sheet under 640 px, a centred dialog from 640 px, Escape, Cancel and the scrim close it, focus returns to the key.
// Inside: the preview, two switches (Show my score, Show my name), the volt Share key (the phone's share sheet with the
// image and a short text carrying the student's invite link while invites are live), Save image, and Cancel. Where files
// cannot be shared, Share sends the text and link; where nothing can be shared, the text is copied. Save always works.
// The card follows the student's theme (Day or Night) and is drawn with the page's own loaded fonts.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/components/AuthProvider';
import { useReferralStatus } from '@/components/referrals/useReferralStatus';
import { referralView } from '@/lib/referrals/friendInvite.mjs';
import { shownFirstName } from '@/lib/displayName.mjs';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '@/components/brand/logoB';
import { CARD_H, CARD_W, SHARE_COPY, cardFileName, cardPalette, shareCard, shareMessage, shareable, wrapWords } from './shareCardModel.mjs';
import '@/components/pro/pro-nudge.css';
import './share-card.css';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function reducedMotion() {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function phone() {
  try { return window.matchMedia('(max-width: 639px)').matches; } catch { return true; }
}
function animateIn(el) {
  if (typeof el.animate !== 'function') return;
  if (reducedMotion()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' }); return; }
  if (phone()) el.animate([{ transform: 'translate3d(0, 100%, 0)' }, { transform: 'translate3d(0, 0, 0)' }], { duration: 300, easing: EASE });
  else el.animate([{ opacity: 0, transform: 'translate3d(0, 8px, 0) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
}
function animateOut(el) {
  if (typeof el.animate !== 'function') return Promise.resolve();
  if (reducedMotion()) return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
  const frames = phone()
    ? [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(0, 100%, 0)' }]
    : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, 6px, 0) scale(0.97)' }];
  return el.animate(frames, { duration: phone() ? 220 : 160, easing: EASE, fill: 'forwards' }).finished.catch(() => {});
}

/** The student's theme as the app shell reads it (arena.css: Night unless the page says Day). */
function pageTheme() {
  try { return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

// ------------------------------------------------------------------------------------------------ drawing
const [VB_X, VB_Y, VB_W, VB_H] = LOGO_B_VIEWBOX.split(' ').map(Number);
const DOT_R = 90;
const DOT_GAP = 58;
const LOGO_W = VB_W + DOT_GAP + DOT_R * 2;

/** Logo B with the site's dot (Logo.jsx), `height` px tall, its top-left at (x, y). */
function drawLogo(ctx, x, y, height, pal) {
  const s = height / VB_H;
  ctx.save();
  ctx.translate(x - VB_X * s, y - VB_Y * s);
  ctx.scale(s, s);
  ctx.fillStyle = pal.ink;
  ctx.fill(new Path2D(LOGO_B_LETTERS));
  const mobi = LOGO_B_MOBI.full;
  ctx.fillStyle = '#D2F000';
  ctx.fill(new Path2D(mobi.body));
  ctx.fillStyle = '#12110E';
  ctx.fill(new Path2D(mobi.visor));
  if (mobi.eyes) { ctx.fillStyle = '#F3EFE4'; ctx.fill(new Path2D(mobi.eyes), 'evenodd'); }
  ctx.fillStyle = pal.dot;
  ctx.beginPath();
  ctx.arc(VB_X + VB_W + DOT_GAP + DOT_R, -DOT_R, DOT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return LOGO_W * s;
}

function font(ctx, weight, size, family, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
}

const P = 88;
const W = CARD_W - P * 2;

/**
 * The card's middle (who, what, the score or what was done, the counts, the one line), from `top`. With `dry` it only
 * measures, so the block can be centred between the head and the foot. Returns the y the block ends at.
 */
function drawBody(ctx, card, pal, faces, top, dry) {
  const text = (t, x, y) => { if (!dry) ctx.fillText(t, x, y); };
  let y = top + 36;
  font(ctx, 600, 36, faces.body);
  ctx.fillStyle = pal.ink2;
  text(card.eyebrow, P, y);

  if (card.subject) {
    font(ctx, 700, 62, faces.display, -1.2);
    ctx.fillStyle = pal.ink;
    for (const line of wrapWords(card.subject, W, (t) => ctx.measureText(t).width, 2)) { y += 76; text(line, P, y); }
  }

  if (card.score) {
    y += 300;
    font(ctx, 800, 300, faces.display, -12);
    ctx.fillStyle = card.score.negative ? pal.bad : pal.score;
    text(card.score.value, P - 8, y);
    const wide = ctx.measureText(card.score.value).width;
    font(ctx, 600, 64, faces.display, -1.2);
    ctx.fillStyle = pal.ink3;
    text(card.score.total, P + wide + 18, y);
  } else if (card.done) {
    font(ctx, 800, 128, faces.display, -4);
    ctx.fillStyle = pal.score;
    y += 24;
    for (const line of wrapWords(card.done, W, (t) => ctx.measureText(t).width, 2)) { y += 132; text(line, P, y); }
  }

  // The counts in three even columns; the time takes the wider last column, so "36m 34s" never runs past the edge.
  if (card.stats.length) {
    y += 104;
    let x = P;
    card.stats.forEach((s) => {
      font(ctx, 700, 60, faces.display, -1.2);
      ctx.fillStyle = pal.ink;
      text(s.value, x, y);
      font(ctx, 600, 28, faces.body);
      ctx.fillStyle = pal.ink3;
      text(s.note ? `${s.label} ${s.note}` : s.label, x, y + 44);
      x += s.label === 'Time' ? 0 : Math.round(W * 0.22);
    });
    y += 44;
  }

  if (card.line) {
    y += 56;
    ctx.fillStyle = pal.line;
    if (!dry) ctx.fillRect(P, y, W, 2);
    font(ctx, 600, 40, faces.body);
    ctx.fillStyle = pal.ink2;
    for (const line of wrapWords(card.line, W, (t) => ctx.measureText(t).width, 3)) { y += 62; text(line, P, y + 10); }
    y += 10;
  }
  return y;
}

/** Draws the card's lines on a 1080 x 1350 canvas. `faces` are the page's display and body font stacks. */
export function drawCard(canvas, card, theme, faces) {
  const ctx = canvas.getContext('2d');
  const pal = cardPalette(theme);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The head: the wordmark, the date on the right.
  drawLogo(ctx, P, P, 60, pal);
  if (card.date) {
    font(ctx, 600, 30, faces.body);
    ctx.fillStyle = pal.ink3;
    ctx.textAlign = 'right';
    ctx.fillText(card.date, CARD_W - P, P + 48);
    ctx.textAlign = 'left';
  }

  // The middle sits a little above the centre of the room between the head and the foot.
  const headEnd = P + 60;
  const footTop = CARD_H - P - 40;
  const height = drawBody(ctx, card, pal, faces, 0, true);
  const top = Math.max(headEnd + 80, Math.round(headEnd + (footTop - headEnd - height) * 0.48));
  drawBody(ctx, card, pal, faces, top, false);

  // The foot: the address, on its own line at the bottom.
  font(ctx, 700, 40, faces.display, -0.6);
  ctx.fillStyle = pal.ink;
  ctx.fillText(card.foot, P, CARD_H - P);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/** The page's own loaded faces, read from elements that use them, once they have loaded. */
async function pageFaces(displayEl, bodyEl) {
  const display = (displayEl && getComputedStyle(displayEl).fontFamily) || 'system-ui, sans-serif';
  const body = (bodyEl && getComputedStyle(bodyEl).fontFamily) || 'system-ui, sans-serif';
  try {
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load(`800 100px ${display}`), document.fonts.load(`700 100px ${display}`), document.fonts.load(`600 40px ${display}`),
        document.fonts.load(`600 40px ${body}`),
      ]);
    }
    await document.fonts?.ready;
  } catch { /* drawn with whatever the browser has */ }
  return { display, body };
}

const toBlob = (canvas) => new Promise((resolve) => { try { canvas.toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); } });

// ------------------------------------------------------------------------------------------------ the sheet
function ShareSheet({ input, onClose }) {
  const dialog = useRef(null);
  const canvasRef = useRef(null);
  const closing = useRef(false);
  const blobRef = useRef(null);
  const titleId = useId();
  const scoreId = useId();
  const nameId = useId();
  const { user } = useAuth();
  const invites = useReferralStatus();
  const firstName = shownFirstName(user?.name, user?.email);
  const [showScore, setShowScore] = useState(true);
  const [showName, setShowName] = useState(Boolean(firstName));
  const [phase, setPhase] = useState('drawing'); // drawing | ready | failed
  const [note, setNote] = useState('');
  const [attempt, setAttempt] = useState(0);
  const card = shareCard({ ...input, firstName, showScore, showName: showName && Boolean(firstName) });
  const fileName = cardFileName(input);

  const finish = useCallback(() => {
    const el = dialog.current;
    if (el?.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
    onClose?.();
  }, [onClose]);
  const requestClose = useCallback(() => {
    const el = dialog.current;
    if (!el || closing.current) return;
    closing.current = true;
    el.dataset.state = 'closing';
    animateOut(el).then(finish);
  }, [finish]);

  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    const back = document.activeElement;
    closing.current = false;
    el.dataset.state = 'open';
    if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    el.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    animateIn(el);
    return () => { if (back?.isConnected && back.getClientRects().length) back.focus?.({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    const onCancel = (event) => { event.preventDefault(); requestClose(); };
    const onNativeClose = () => { if (!closing.current) { closing.current = true; onClose?.(); } };
    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onNativeClose);
    el.addEventListener('keydown', onKeyDown);
    return () => { el.removeEventListener('cancel', onCancel); el.removeEventListener('close', onNativeClose); el.removeEventListener('keydown', onKeyDown); };
  }, [requestClose, onClose]);

  // Draw (again) whenever what the card shows changes. The image file is made right away, so Share can hand it to the phone
  // inside the press that asked for it.
  const cardKey = JSON.stringify(card);
  useEffect(() => {
    let alive = true;
    const canvas = canvasRef.current;
    if (!canvas || !card) return undefined;
    blobRef.current = null;
    (async () => {
      try {
        const faces = await pageFaces(dialog.current?.querySelector('.pn-title'), dialog.current);
        if (!alive) return;
        drawCard(canvas, card, pageTheme(), faces);
        const blob = await toBlob(canvas);
        if (!alive) return;
        blobRef.current = blob;
        setPhase(blob ? 'ready' : 'failed');
      } catch {
        if (alive) setPhase('failed');
      }
    })();
    return () => { alive = false; };
  }, [cardKey, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = invites.status === 'ready' ? referralView(invites.body) : null;
  const message = shareMessage(invite);

  const save = () => {
    const blob = blobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    setNote(SHARE_COPY.saved);
  };

  const share = async () => {
    const blob = blobRef.current;
    setNote('');
    const file = blob && typeof File === 'function' ? new File([blob], fileName, { type: 'image/png' }) : null;
    try {
      if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: message.title, text: message.text });
        return;
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: message.title, text: message.text });
        return;
      }
      await navigator.clipboard.writeText(message.text);
      setNote(SHARE_COPY.copied);
    } catch (error) {
      // Closing the phone's share sheet is the student's own choice, not a failure.
      if (error?.name === 'AbortError') return;
      setNote(SHARE_COPY.shareFailed);
    }
  };

  const onDialogClick = (event) => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) requestClose();
  };

  const ready = phase === 'ready';
  return (
    <dialog ref={dialog} className="pn-sheet shr-sheet" aria-labelledby={titleId} onClick={onDialogClick}>
      <span className="pn-handle" aria-hidden="true" />
      <div className="pn-body shr-body">
        <div className="pn-top">
          <h2 id={titleId} className="pn-title shr-title">{SHARE_COPY.title}</h2>
          <button type="button" className="pn-close mk-press" aria-label="Close" onClick={requestClose}><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>
        <p className="shr-lead">{SHARE_COPY.lead}</p>
        <div className="shr-preview" data-phase={phase}>
          <canvas ref={canvasRef} width={CARD_W} height={CARD_H} role="img" aria-label={card?.alt || ''} />
          {phase === 'drawing' ? <span className="shr-preview__wait" role="status">{SHARE_COPY.drawing}</span> : null}
          {phase === 'failed' ? (
            <div className="shr-preview__fail" role="alert">
              <p>{SHARE_COPY.drawFailed}</p>
              <button type="button" className="btn-outline md mk-press" onClick={() => { setPhase('drawing'); setAttempt((n) => n + 1); }}>{SHARE_COPY.retry}</button>
            </div>
          ) : null}
        </div>
        <div className="shr-switches">
          <div className="shr-switch">
            <div className="shr-switch__text">
              <span id={scoreId} className="shr-switch__label">{SHARE_COPY.score}</span>
              {!showScore ? <span className="shr-switch__hint">{SHARE_COPY.scoreHint}</span> : null}
            </div>
            <Switch checked={showScore} onChange={setShowScore} aria-labelledby={scoreId} data-autofocus="" />
          </div>
          <div className="shr-switch">
            <div className="shr-switch__text">
              <span id={nameId} className="shr-switch__label">{SHARE_COPY.name}</span>
              <span className="shr-switch__hint">{firstName ? SHARE_COPY.nameHint(firstName) : SHARE_COPY.noName}</span>
            </div>
            <Switch checked={showName && Boolean(firstName)} onChange={setShowName} disabled={!firstName} aria-labelledby={nameId} />
          </div>
        </div>
      </div>
      <div className="pn-foot shr-foot">
        <p className="shr-note" role="status" aria-live="polite">{note}</p>
        <div className="shr-actions">
          <button type="button" className="btn-volt pn-go shr-go mk-press" disabled={!ready} onClick={share}>{SHARE_COPY.share}</button>
          <button type="button" className="btn-outline md shr-save mk-press" disabled={!ready} onClick={save}>{SHARE_COPY.save}</button>
          <button type="button" className="pn-later mk-press" onClick={requestClose}>{SHARE_COPY.cancel}</button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * The quiet key and its sheet. Draws nothing for a paper with nothing answered.
 * subjectName, mode, total, marks, durationMs, completedAt, finding, tomorrow: what the result page already computed.
 */
export default function ShareResult(props) {
  const [open, setOpen] = useState(false);
  if (!shareable(props.marks)) return null;
  return (
    <div className="shr-row">
      <button type="button" className="shr-open mk-press" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Share2 size={17} strokeWidth={2} aria-hidden="true" />
        <span>{SHARE_COPY.open}</span>
      </button>
      {open ? <ShareSheet input={props} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
