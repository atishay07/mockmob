"use client";

// The Start sheet's pictures: the app's photo-real, lamp-lit subject objects (byte copies of
// flutter_app/assets/art/obj-*.webp, bundled from ./art so the sheet never waits on a missing public
// file) and a few drawn graphics for the rows that are not one subject (a full mock paper, the
// NTA-style screen, a paused session, a check). All decorative: every row prints its words beside
// them, so the pictures are aria-hidden and the object keeps its plain alt only where it stands alone.
import Image from 'next/image';
import { SUBJECT_ART, artBox, subjectArt } from './startModel.mjs';
import accountancy from './art/obj-accountancy.webp';
import business from './art/obj-business.webp';
import economics from './art/obj-economics.webp';
import english from './art/obj-english.webp';
import generaltest from './art/obj-generaltest.webp';
import mathematics from './art/obj-mathematics.webp';
import physics from './art/obj-physics.webp';
import chemistry from './art/obj-chemistry.webp';
import biology from './art/obj-biology.webp';
import history from './art/obj-history.webp';
import politicalscience from './art/obj-politicalscience.webp';
import geography from './art/obj-geography.webp';
import psychology from './art/obj-psychology.webp';
import sociology from './art/obj-sociology.webp';
import computerscience from './art/obj-computerscience.webp';
import language from './art/obj-language.webp';
import stopwatch from './art/hybrid-stopwatch.webp';

const FILES = { accountancy, business, economics, english, generaltest, mathematics, physics, chemistry, biology, history, politicalscience, geography, psychology, sociology, computerscience, language };

/**
 * One subject object, centred and never cropped, standing on a soft contact shadow under its foot,
 * in a pool of lamp light. `size` is the box in px (square unless `height` is given). `floor` stands it on
 * the box's floor line with little air around it (the subject chips, where objects share one shelf).
 */
export function SubjectObject({ subject, size = 64, height = size, lit = true, floor = false, priority = false, className = '' }) {
  const a = subjectArt(subject);
  const file = a ? FILES[a.name] : null;
  const box = a ? artBox(a, size, height, floor ? { pad: 0.04, align: 'bottom' } : undefined) : null;
  if (!a || !file || !box) return <span className={`st-obj st-obj--none ${className}`} style={{ width: size, height }} aria-hidden="true" />;
  return (
    <span className={`st-obj ${lit ? 'st-obj--lit' : ''} ${className}`} style={{ width: size, height }} aria-hidden="true" data-art={a.name}>
      {lit ? <span className="st-obj__lamp" /> : null}
      <span className="st-obj__shadow" style={{ left: box.shadow.x, top: box.shadow.y - 3, width: box.shadow.width }} />
      <Image className="st-obj__img" src={file} alt="" width={Math.round(box.width)} height={Math.round(box.height)}
        style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
        priority={priority} draggable={false} />
    </span>
  );
}

/** Three of the student's objects fanned out (Choose your own). */
export function SubjectFan({ subjects = [], size = 64 }) {
  const list = subjects.filter((id) => subjectArt(id)).slice(0, 3);
  if (!list.length) return <DrawnGraphic kind="paper" size={size} />;
  const small = Math.round(size * 0.62);
  return (
    <span className="st-fan" style={{ width: size, height: size }} aria-hidden="true">
      {list.map((id, i) => (
        <span key={id} className="st-fan__item" style={{ '--i': i, '--n': list.length, width: small, height: small }}>
          <SubjectObject subject={id} size={small} lit={false} />
        </span>
      ))}
    </span>
  );
}

/** Drawn graphics, in the sheet's own ink: currentColor plus the accent token. */
export function DrawnGraphic({ kind, size = 64 }) {
  if (kind === 'nta') {
    // The exam-style screen: the blue bar, a question block and the answer palette.
    return (
      <span className="st-draw st-draw--nta" style={{ width: size, height: size }} aria-hidden="true">
        <svg viewBox="0 0 64 64" width={size} height={size} focusable="false">
          <rect x="6" y="11" width="52" height="40" rx="5" className="st-ink-surface" />
          <rect x="6" y="11" width="52" height="8" rx="5" className="st-nta-bar" />
          <rect x="6" y="15" width="52" height="4" className="st-nta-bar" />
          <rect x="11" y="24" width="24" height="3" rx="1.5" className="st-ink-line" />
          <rect x="11" y="30" width="19" height="3" rx="1.5" className="st-ink-faint" />
          <rect x="11" y="36" width="22" height="3" rx="1.5" className="st-ink-faint" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={40 + (i % 3) * 5.5} y={24 + Math.floor(i / 3) * 6} width="4" height="4" rx="1" className={i === 1 ? 'st-nta-red' : i === 4 ? 'st-ink-faint' : 'st-nta-green'} />
          ))}
          <rect x="40" y="38" width="15" height="7" rx="2" className="st-nta-green" />
          <rect x="26" y="51" width="12" height="4" className="st-ink-faint" />
          <rect x="20" y="55" width="24" height="2.5" rx="1.25" className="st-ink-faint" />
        </svg>
      </span>
    );
  }
  if (kind === 'paper') {
    // A full paper: a stack of sheets and a 60-minute dial.
    return (
      <span className="st-draw st-draw--paper" style={{ width: size, height: size }} aria-hidden="true">
        <svg viewBox="0 0 64 64" width={size} height={size} focusable="false">
          <rect x="15" y="12" width="30" height="40" rx="4" className="st-ink-faint" transform="rotate(-8 30 32)" />
          <rect x="17" y="10" width="30" height="40" rx="4" className="st-ink-surface" />
          <rect x="22" y="17" width="16" height="3" rx="1.5" className="st-ink-line" />
          <rect x="22" y="24" width="20" height="2.5" rx="1.25" className="st-ink-faint" />
          <rect x="22" y="29" width="18" height="2.5" rx="1.25" className="st-ink-faint" />
          <rect x="22" y="34" width="20" height="2.5" rx="1.25" className="st-ink-faint" />
          <circle cx="45" cy="44" r="11" className="st-dial" />
          <path d="M45 37.5 V44 L49.5 46.5" className="st-dial-hand" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (kind === 'resume') {
    return (
      <span className="st-draw st-draw--resume" style={{ width: size, height: size }} aria-hidden="true">
        <svg viewBox="0 0 64 64" width={size} height={size} focusable="false">
          <circle cx="32" cy="34" r="19" className="st-dial" />
          <rect x="28" y="9" width="8" height="5" rx="2" className="st-ink-line" />
          <path d="M28 26 L40 34 L28 42 Z" className="st-accent-fill" />
        </svg>
      </span>
    );
  }
  // 'check' and 'repair': a card with a mistake, and the tick that fixes it (inks on as it opens).
  return (
    <span className="st-draw st-draw--check" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size} focusable="false">
        <rect x="12" y="12" width="34" height="42" rx="5" className="st-ink-surface" />
        <rect x="18" y="20" width="18" height="3" rx="1.5" className="st-ink-line" />
        <rect x="18" y="27" width="22" height="2.5" rx="1.25" className="st-ink-faint" />
        <rect x="18" y="32" width="16" height="2.5" rx="1.25" className="st-ink-faint" />
        <circle cx="44" cy="42" r="12" className="st-accent-fill" />
        <path d="M38.5 42.5 L42.5 46.5 L50 38.5" pathLength="1" className="st-tick" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * The app's lamp-lit stopwatch (flutter_app/assets/art/hybrid-stopwatch.webp, 596 x 768) for a Full mock, with its long
 * hand drawn at the render's pivot (HybridSpec.stopwatch: 0.471, 0.605), so web and app show the same object (F4).
 * `width` sets the size; the height follows the render. The enamel face is white in both themes, so the hand is ink.
 */
export function Stopwatch({ width = 66, className = '' }) {
  const height = Math.round((width * 768) / 596);
  return (
    <span className={`st-watch ${className}`} style={{ width, height }} aria-hidden="true">
      <Image className="st-watch__img" src={stopwatch} alt="" width={width} height={height} draggable={false} />
      <svg className="st-watch__hand" viewBox="0 0 596 768" width={width} height={height} focusable="false">
        <line x1="281" y1="465" x2="372" y2="352" />
        <circle cx="281" cy="465" r="13" />
      </svg>
    </span>
  );
}

/**
 * NTA mode's exam screen drawn small: the blue bar and the answer palette in the exam's own colours (answered green,
 * marked purple, not answered orange, not visited white). The same object on the Start sheet and on Practice.
 */
const PALETTE = ['g', 'g', 'o', 'e', 'p', 'g', 'e', 'e', 'g', 'e', 'e', 'e'];
export function ExamPanel({ width = 76, height = 64, className = '' }) {
  return (
    <span className={`st-exam ${className}`} style={{ width, height }} aria-hidden="true">
      {PALETTE.map((tone, i) => <b key={i} data-tone={tone} style={{ left: `${8 + (i % 4) * 22}%`, top: `${28 + Math.floor(i / 4) * 23}%` }} />)}
    </span>
  );
}

/** Smart practice: topic weights, drawn; the weakest topic carries the accent. */
export function WeightsGlyph({ width = 60, height = 56, className = '' }) {
  return (
    <span className={`st-weights ${className}`} style={{ width, height }} aria-hidden="true">
      <i style={{ height: '22%' }} /><i data-hot="" style={{ height: '58%' }} /><i style={{ height: '36%' }} /><i style={{ height: '16%' }} />
    </span>
  );
}

/** The right picture for a row or the hero. */
export function RowArt({ graphic, subject, subjects, size = 64, height, priority = false }) {
  if (graphic === 'subject' && subject && subjectArt(subject)) return <SubjectObject subject={subject} size={size} height={height} priority={priority} />;
  if (graphic === 'fan') return <SubjectFan subjects={subjects} size={size} />;
  if (graphic === 'stopwatch') return <Stopwatch width={Math.round(size * 0.8)} />;
  if (graphic === 'exam') return <ExamPanel width={Math.round(size * 1.15)} height={Math.round(size * 0.97)} />;
  return <DrawnGraphic kind={graphic === 'subject' ? 'check' : graphic} size={size} />;
}

export const ART_NAMES = Object.keys(SUBJECT_ART);
