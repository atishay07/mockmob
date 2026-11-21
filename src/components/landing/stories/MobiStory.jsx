'use client';

// The Ask Mobi row story (owner LK365, 21 Nov 2026): the feature shown the way a student uses it, worked by the demo cursor
// (mobiStory.mjs holds the script). Beats: the coaching sheet in the camera, the shutter and Send; the scan down the whole
// page, lighting each line it reads; the page into the chat, its CUET chapter chip lit; Mobi's read line by line with the slip
// circled; a fresh question answered and the 10 more from the bank (critic round, 21 Nov 2026 evening: one idea a beat).
//
// What each screen mirrors (looked at in /preview/arena?view=prepos at 390x844):
//   the composer row     src/components/ai/ChatComposer.jsx (.ach-composer): the photo row's thumbnail, the round Send key
//   the wait line        src/components/ai/ChatThread.jsx (.ach-wait): the magnifier Mobi while a photo is read
//   the read             ChatThread.jsx MistakeAnswer (.ach-mistake): the chapter named, why, the likely slip, the checks
//   the practice key     bringMistake.mjs nextStep: "Practise 10 <chapter> questions", to Practice on that chapter
//   the camera           the phone's own camera (ChatComposer's Photo key asks for it, capture="environment")
// Truth: every word and number of the example is bringMistakeCopy.mjs (BRING_MISTAKE, pinned by its test); the app's words
// are chatCopy.mjs (CHAT_COPY) and bringMistake.mjs (MISTAKE_COPY), copied here and held equal by story_mobi_1121.test.mjs
// (importing them would bring the server's request rules into the home page's bundle).
//
// `photo` is the app's own switch (data/mistake_photo.mjs, page.js passes MISTAKE_PHOTO_ON). Off: no camera; the question
// is typed into the composer and the rest is the same.
//
// The contract (tmp/1121-stories/COMMON.md): every phase is drawn in one fixed-size screen (the layers share one grid cell),
// so the height never changes. Every change the cursor makes is a real click on a real button here; what follows a click
// (the flash, the scan, the chips, the lines) is CSS keyed off data-phase, plus the two timeouts after Send (MOBI_TIMING).
// A reader can work it by hand, in any order: the step row jumps to any step. Reduced motion: the end state of each step at
// once (no scan wait).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Check, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { signupPathFor } from '@/lib/auth-redirect';
import MobiMark from '@/components/ai/MobiMark';
import Doodle from '@/components/doodle/Doodle';
import { BRING_MISTAKE as W } from '../bringMistakeCopy.mjs';
import { MOBI_PRACTICE, MOBI_TIMING } from './mobiStory.mjs';
import './mobi-story.css';

// The app's own words (held equal to their sources by the test).
export const APP_WORDS = Object.freeze({
  photoKey: 'Photo', // CHAT_COPY.photoKey
  fieldPhoto: 'Add what you marked, if you like', // CHAT_COPY.fieldPhoto
  fieldMistake: 'Paste the question and its options', // CHAT_COPY.fieldMistake
  kindDoubt: 'A doubt', // CHAT_COPY.kindDoubt
  kindMistake: 'A question I got wrong', // CHAT_COPY.kindMistake
  marked: 'What I marked', // CHAT_COPY.marked
  send: 'Send to Mobi', // CHAT_COPY.send
  photoPrivacy: 'Keep your name and roll number out of the photo. MockMob does not keep it.', // CHAT_COPY.photoPrivacy
  photoTake: 'Take a photo', // CHAT_COPY.photoTake
  headline: 'What do you want to work on?', // CHAT_COPY.headline
  sendingPhoto: 'Mobi is reading your photo', // MISTAKE_COPY.sendingPhoto
  sending: 'Mobi is reading your question', // MISTAKE_COPY.sending
  aiNote: 'Mobi is AI and can be wrong.', // CHAT_COPY.aiNote
});

const LETTERS = ['A', 'B', 'C', 'D'];
// The order of the screen's phases. The step row's four steps: Photo (camera, shot, scan), Read (asked, read), Check, Practise.
export const PHASES = Object.freeze(['camera', 'shot', 'scan', 'asked', 'read', 'check', 'practice']);
const STEP_OF = Object.freeze({ camera: 0, shot: 0, scan: 0, asked: 1, read: 1, check: 2, practice: 3 });
const STEP_TO = Object.freeze(['camera', 'read', 'check', 'practice']);
// A ratio ("3 : 2") never breaks across two lines.
const keep = (text) => String(text).replace(/(\d) : (?=\d)/g, '$1 : ');
const at = (phase, from) => PHASES.indexOf(phase) >= PHASES.indexOf(from);

function reducedNow() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
}

// The slip, with its two stressed parts: the wrong ratio circled in pen, and what to do instead under the highlighter.
// Both phrases are found in the copy's own sentence; one that is not there is simply left unmarked.
function Slip({ text, on }) {
  const ratio = keep(W.slip.options[W.slip.chosen]);
  const fix = 'out of the whole first.';
  const body = keep(text);
  const a = body.indexOf(ratio);
  const b = body.indexOf(fix, a + 1);
  if (a < 0) return <>{body}</>;
  return (
    <>
      {body.slice(0, a)}
      <Doodle mark="circle" tone="pen" when={on} delay={500}>{ratio}</Doodle>
      {b > a ? <>{body.slice(a + ratio.length, b)}<Doodle mark="highlight" tone="volt" when={on} delay={1100}>{fix}</Doodle>{body.slice(b + fix.length)}</> : body.slice(a + ratio.length)}
    </>
  );
}

// The coaching sheet: printed on ruled paper, the student's own pen circle on the option they marked.
function Sheet({ mini = false }) {
  return (
    <div className={`st-mobi__sheet${mini ? ' st-mobi__sheet--mini' : ''}`} aria-hidden={mini || undefined}>
      <p className="st-mobi__sheet-head st-mobi__lit" style={{ '--lit': 0 }}><span>Coaching test, {W.slip.subject}</span><span>Q 14</span></p>
      <p className="st-mobi__sheet-q st-mobi__lit" style={{ '--lit': 1 }}>{keep(W.slip.q)}</p>
      <ol className="st-mobi__sheet-opts">
        {W.slip.options.map((option, i) => (
          <li key={option} className="st-mobi__lit" style={{ '--lit': 2 + Math.floor(i / 2) }} data-chosen={i === W.slip.chosen || undefined}>
            <span className="st-mobi__sheet-l">({LETTERS[i].toLowerCase()})</span> {keep(option)}
          </li>
        ))}
      </ol>
      <span className="st-mobi__sheet-next" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}

export default function MobiStory({ photo = true }) {
  const { isAuthenticated } = useAuth();
  const [phase, setPhase] = useState('camera');
  const [pick, setPick] = useState(null);
  const timers = useRef([]);
  const clear = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };
  useEffect(() => clear, []);

  const go = (next) => { clear(); setPhase(next); if (PHASES.indexOf(next) < PHASES.indexOf('check')) setPick(null); };
  const send = () => {
    clear();
    setPick(null);
    if (reducedNow()) { setPhase('read'); return; }
    setPhase('scan');
    timers.current.push(window.setTimeout(() => setPhase('asked'), MOBI_TIMING.scan));
    timers.current.push(window.setTimeout(() => setPhase('read'), MOBI_TIMING.read));
  };

  const step = STEP_OF[phase];
  const chatOn = at(phase, 'asked');
  const readOn = at(phase, 'read');
  const answered = pick !== null;
  const right = pick === W.check.correct;
  const chapter = W.read.chapter;
  // The practice set the read ends on: Practice on that chapter, from the bank (bringMistake.mjs nextStep); a guest signs up first.
  const practiceTo = isAuthenticated ? MOBI_PRACTICE.href : signupPathFor(MOBI_PRACTICE.href);
  const stepNames = [photo ? APP_WORDS.photoKey : W.steps[0], ...W.steps.slice(1)];
  const layer = (on) => ({ 'aria-hidden': on ? undefined : 'true', inert: !on });
  const cardOf = (name) => (phase === name ? 'top' : at(phase, name) ? 'under' : 'away');

  return (
    <div className="st st-mobi" data-phase={phase} data-photo={photo ? 'on' : 'off'} data-pick={answered ? (right ? 'right' : 'wrong') : undefined}>
      <div className="st-mobi__screen">
        <div className="st-mobi__steps" role="group" aria-label="How it works, on an example">
          {stepNames.map((name, i) => (
            <button key={name} type="button" className="st-mobi__step" data-demo="mobi-step" aria-pressed={step === i}
              data-done={i < step || undefined} onClick={() => go(STEP_TO[i])}>
              <span className="st-mobi__step-n" aria-hidden="true">{i < step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>{name}
            </button>
          ))}
        </div>

        <div className="st-mobi__stage">
          {/* The question coming in: the camera (photo on) or the composer (photo off). On a wide screen it stays at the left. */}
          <div className="st-mobi__in" {...layer(!chatOn)} data-layer="in">
            {photo ? (
              <div className="st-mobi__finder">
                <div className="st-mobi__photo">
                  <Sheet />
                  <span className="st-mobi__brackets" aria-hidden="true"><i /><i /><i /><i /></span>
                  <span className="st-mobi__scan" aria-hidden="true" />
                  <span className="st-mobi__flash" aria-hidden="true" />
                </div>
              </div>
            ) : (
              <div className="st-mobi__compose">
                <p className="st-mobi__hello"><MobiMark size={28} /><span>{APP_WORDS.headline}</span></p>
                <div className="st-mobi__kind" aria-hidden="true"><span>{APP_WORDS.kindDoubt}</span><span data-on>{APP_WORDS.kindMistake}</span></div>
                <button type="button" className="st-mobi__field" data-demo="mobi-type" onClick={() => go('shot')} aria-label={APP_WORDS.fieldMistake}>
                  <span className="st-mobi__field-hint">{APP_WORDS.fieldMistake}</span>
                  <span className="st-mobi__typed" aria-hidden="true">
                    {`${keep(W.slip.q)} ${W.slip.options.map((o, i) => `(${LETTERS[i].toLowerCase()}) ${keep(o)}`).join('  ')}`.split(' ').map((word, i) => (
                      <span key={i} style={{ '--w': i }}>{word} </span>
                    ))}
                  </span>
                  <span className="st-mobi__scan" aria-hidden="true" />
                </button>
                <p className="st-mobi__mini"><span>{APP_WORDS.marked}</span><b>{LETTERS[W.slip.chosen]}</b></p>
              </div>
            )}
            {/* The bar under it: the shutter, then the composer with the photo and Send, then Mobi reading. */}
            <div className="st-mobi__bar">
              {photo ? (
                <div className="st-mobi__shutter-row" data-bar="shutter">
                  <button type="button" className="st-mobi__shutter" data-demo="mobi-shoot" onClick={() => go('shot')} aria-label={APP_WORDS.photoTake}><span /></button>
                </div>
              ) : null}
              <div className="st-mobi__composer" data-bar="composer">
                {photo ? <span className="st-mobi__thumb" aria-hidden="true"><Sheet mini /></span> : null}
                <span className="st-mobi__composer-hint">{photo ? APP_WORDS.fieldPhoto : APP_WORDS.aiNote}</span>
                <button type="button" className="st-mobi__send" data-demo="mobi-send" onClick={send} aria-label={APP_WORDS.send}>
                  <ArrowUp size={22} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
              <div className="st-mobi__wait" data-bar="wait" role="status">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo ? '/brand/mascot/mobi-magnifier.webp' : '/brand/mascot/mobi-reading.webp'} width={photo ? 31 : 29} height={46} alt="" loading="lazy" decoding="async" />
                <span>{phase === 'scan' ? (photo ? APP_WORDS.sendingPhoto : APP_WORDS.sending) : ''}</span>
              </div>
              <p className="st-mobi__privacy" data-bar="done">{photo ? APP_WORDS.photoPrivacy : APP_WORDS.aiNote}</p>
            </div>
          </div>

          {/* The chat: three cards dealt onto one another (the read, the check, the practice set). */}
          <div className="st-mobi__chat" {...layer(chatOn)} data-layer="chat">
            {/* A wide screen shows the chat beside the question from the start: empty until the question is in. */}
            <p className="st-mobi__empty" aria-hidden="true"><MobiMark size={36} /><span>{APP_WORDS.headline}</span></p>
            <section className="st-mobi__card st-mobi__card--read" data-card={phase === 'asked' || phase === 'read' ? 'top' : chatOn ? 'under' : 'away'} aria-label={W.read.title} {...layer(phase === 'asked' || phase === 'read')}>
              <div className="st-mobi__head st-mobi__blk">
                <div className="st-mobi__ask">
                  {photo ? <span className="st-mobi__thumb st-mobi__thumb--sent" aria-hidden="true"><Sheet mini /></span> : null}
                  <div className="st-mobi__ask-body">
                    <p className="st-mobi__ask-q">{keep(W.slip.q)}</p>
                    <p className="st-mobi__chose"><X size={13} strokeWidth={3.2} aria-hidden="true" />{W.slip.chosenLabel} {LETTERS[W.slip.chosen]}, {keep(W.slip.options[W.slip.chosen])}</p>
                  </div>
                </div>
                <div className="st-mobi__chips">
                  <p className="st-mobi__chip" style={{ '--i': 0 }}><span>Subject</span><b>{W.slip.subject}</b></p>
                  <p className="st-mobi__chip st-mobi__chip--volt" style={{ '--i': 1 }}><span>{W.read.chapterLabel}</span><b>{chapter}</b></p>
                </div>
              </div>
              <div className="st-mobi__answer st-mobi__blk">
                <p className="st-mobi__mobi"><MobiMark size={20} /><span>{keep(W.read.why.label)}</span></p>
                <ol className="st-mobi__why">
                  {W.read.why.lines.map(([who, work, share], i) => (
                    <li key={who} style={{ '--i': i }}><b>{who}</b><span>{work}</span><em>{share}</em></li>
                  ))}
                </ol>
                <div className="st-mobi__slip" style={{ '--i': W.read.why.lines.length }}>
                  <p className="st-mobi__slip-label">{W.read.slip[0]}:</p>
                  <p className="st-mobi__slip-text"><Slip text={W.read.slip[1]} on={readOn} /></p>
                </div>
              </div>
              <button type="button" className="st-mobi__next" data-demo="mobi-tocheck" onClick={() => go('check')}>{W.next[1]}</button>
            </section>

            <section className="st-mobi__card st-mobi__card--check st-mobi__check" data-card={cardOf('check')} aria-label={W.check.title} {...layer(phase === 'check')}>
              <p className="st-mobi__mobi"><MobiMark size={20} /><span>{W.check.title}</span></p>
              <p className="st-mobi__check-q">{keep(W.check.q)}</p>
              <div className="st-mobi__opts" role="group" aria-label={W.check.hint}>
                {W.check.options.map((option, i) => {
                  const state = !answered ? undefined : i === W.check.correct ? 'correct' : i === pick ? 'wrong' : 'muted';
                  return (
                    <button key={option} type="button" className="st-mobi__opt" data-demo="mobi-option" data-state={state} aria-pressed={pick === i}
                      onClick={() => { if (!answered) setPick(i); }}>
                      <span className="st-mobi__opt-key" aria-hidden="true">{LETTERS[i]}</span><span>{keep(option)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="st-mobi__verdict" role="status">
                {answered ? (
                  <>
                    <p className="st-mobi__verdict-head">{right ? W.check.right : W.check.wrong}</p>
                    <p className="st-mobi__verdict-why">{keep(W.check.why)}</p>
                  </>
                ) : <p className="st-mobi__verdict-hint">{W.check.hint}</p>}
              </div>
              <button type="button" className="st-mobi__next" data-demo="mobi-topractice" onClick={() => go('practice')}>{W.next[2]}</button>
            </section>

            <section className="st-mobi__card st-mobi__card--practice st-mobi__practice" data-card={cardOf('practice')} aria-label={W.practice.title} {...layer(phase === 'practice')}>
              <p className="st-mobi__mobi"><MobiMark size={20} /><span>{W.practice.title}</span></p>
              <p className="st-mobi__set"><b>{W.practice.count}</b><span>{W.practice.what}</span></p>
              <p className="st-mobi__from">{W.practice.from}</p>
              {/* The set itself: one tile a question, dealt from the bank (the count is the practice set's, W.practice.count). */}
              <ol className="st-mobi__deck" aria-hidden="true">
                {Array.from({ length: W.practice.count }, (_, i) => <li key={i} style={{ '--i': i }}>{i + 1}</li>)}
              </ol>
              <p className="st-mobi__set-why">{W.practice.why}</p>
              <Link href={practiceTo} className="st-mobi__go" data-demo="mobi-practice" prefetch={false}>{MOBI_PRACTICE.label}</Link>
            </section>
          </div>
        </div>
      </div>
      <p className="st-mobi__honest">{W.honest}</p>
    </div>
  );
}
