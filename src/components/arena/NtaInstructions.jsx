"use client";

// NTA mode's instructions page (N1, owner LK297, 17 Nov 2026), drawn before the paper's clock starts. It follows NTA's own
// "General Instructions" page (its public mock at nta.ac.in/Quiz, seen 17 Nov 2026, and the CUET (UG) 2025 Information Bulletin,
// Appendix V): the same headings and order, NTA's words for the keys and the five symbols, a declaration and one key. What is
// MockMob's own (the language note, the exam-space rule, the marking and the screen choice) is said in plain words under its own
// heading. Every number comes from the mode (data/test_modes.js) or the integrity policy (data/exam_integrity.mjs), never typed.
//
// Styles: src/app/(app)/test/nta-classic.css (.nta-ins), inside the runner's NTA frame, so the five symbols are the runner's own.
import { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { INTEGRITY_RULES } from './ExamIntegrityGuard';

// The five symbols in NTA's order, each with NTA's name and NTA's line for it.
export const NTA_SYMBOLS = Object.freeze([
  ['notvisited', 'Not Visited', 'You have not visited the question yet.'],
  ['visited', 'Not Answered', 'You have not answered the question.'],
  ['answered', 'Answered', 'You have answered the question.'],
  ['marked', 'Marked for Review', 'You have NOT answered the question, but have marked it for review. It is not evaluated.'],
  ['marked-answered', 'Answered & Marked for Review', 'You have answered the question and marked it for review. It will be considered for evaluation.'],
]);

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export default function NtaInstructions({ subject, questions, minutes, marking, screen = 'nta', backHref = '/dashboard', onStart }) {
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const tickId = useId();
  const hintId = useId();
  const start = () => {
    if (!ready || starting) return;
    setStarting(true);
    onStart?.();
  };
  const right = marking?.right;
  const wrong = marking?.wrong;
  const blank = marking?.blank;
  const hasMarking = [right, wrong, blank].every(Number.isFinite);

  return (
    <div className="nta-ins">
      <header className="nta-ins__bar">
        <Link href={backHref} className="nta-ins__back"><ChevronLeft aria-hidden="true" />Back to Practice</Link>
        <h1 className="nta-ins__title">General Instructions</h1>
        <p className="nta-ins__lang"><span>Language</span><b>English</b></p>
      </header>

      <div className="nta-ins__page">
        <p className="nta-ins__lead">Please read the instructions carefully</p>

        {/* The paper at a glance: what the rest of the page is about, before any rule. */}
        <dl className="nta-ins__facts">
          <div><dt>Subject Name</dt><dd>{subject}</dd></div>
          <div><dt>Questions</dt><dd>{questions}</dd></div>
          <div><dt>Duration</dt><dd>{minutes} min</dd></div>
          {hasMarking ? (
            <div className="nta-ins__marks">
              <dt>Marking</dt>
              <dd>
                <span><b>{signed(right)}</b> right</span><span><b>{signed(wrong)}</b> wrong</span><span><b>{signed(blank)}</b> not answered</span>
              </dd>
            </div>
          ) : null}
        </dl>

        <section className="nta-ins__part" aria-labelledby={`${tickId}-general`}>
          <h2 id={`${tickId}-general`}>General Instructions:</h2>
          <ol className="nta-ins__list" start={1}>
            <li>The clock is set at the server. The countdown timer at the top right of the screen shows the time left. When it reaches zero, the test ends by itself and your saved answers are submitted. You do not have to submit.</li>
            <li>
              The Question Palette at the right of the screen shows the status of each question with one of these symbols:
              <ul className="nta-ins__symbols">
                {NTA_SYMBOLS.map(([state, name, line]) => (
                  <li key={state}>
                    <span className={`nta-n-sym nta-n-sym--${state}`} aria-hidden="true" />
                    <span><b>{name}</b>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="nta-ins__mind">A question that is only <b>Marked for Review</b> is not evaluated. <b>Answered &amp; Marked for Review</b> is.</p>
            </li>
            <li>
              {/* role="img": a name on a plain span is not read out, so these keys were silent gaps to a screen reader. */}
              Click <span className="nta-ins__key" role="img" aria-label="the right arrow"><ChevronRight aria-hidden="true" /></span> at the left of the Question Palette to fold it away and give the question more room, and <span className="nta-ins__key" role="img" aria-label="the left arrow"><ChevronLeft aria-hidden="true" /></span> to bring it back. On a phone, the Question Palette key at the foot of the screen opens it.
            </li>
            <li>
              <span className="nta-ins__round" role="img" aria-label="The down arrow"><ArrowDown aria-hidden="true" /></span> takes you to the end of the question and <span className="nta-ins__round" role="img" aria-label="the up arrow"><ArrowUp aria-hidden="true" /></span> back to its top, without scrolling.
            </li>
          </ol>
        </section>

        <section className="nta-ins__part" aria-labelledby={`${tickId}-nav`}>
          <h2 id={`${tickId}-nav`}>Navigating to a Question:</h2>
          <ol className="nta-ins__list" start={5}>
            <li>Click a question number in the Question Palette to go straight to it. This does <b>NOT</b> save your answer to the current question.</li>
            <li><b className="nta-ins__k nta-ins__k--save">Save &amp; Next</b> saves your answer to the current question and opens the next one.</li>
            <li><b className="nta-ins__k nta-ins__k--review">Mark for Review &amp; Next</b> saves your answer to the current question, marks it for review and opens the next one.</li>
          </ol>
        </section>

        <section className="nta-ins__part" aria-labelledby={`${tickId}-answer`}>
          <h2 id={`${tickId}-answer`}>Answering a Question:</h2>
          <ol className="nta-ins__list" start={8}>
            <li>To choose an answer, click the button of one of the options. To change it, click another option. To clear it, click the chosen option again or click <b className="nta-ins__k">Clear Response</b>.</li>
            <li className="nta-ins__must">To save your answer, you <b>MUST</b> click Save &amp; Next or Mark for Review &amp; Next. Previous and the Question Palette do not save it.</li>
            <li>To change a saved answer, open that question, choose again and save again.</li>
            <li>Submit is at the foot of the Question Palette. A summary of your answers asks you to confirm first. After you submit, nothing can be changed.</li>
          </ol>
        </section>

        <section className="nta-ins__part nta-ins__part--ours" aria-labelledby={`${tickId}-ours`}>
          <h2 id={`${tickId}-ours`}>In MockMob&rsquo;s NTA mode:</h2>
          <ul className="nta-ins__plain">
            <li><b>Language.</b> In the real exam, your profile picture at the top right changes the paper&rsquo;s language. MockMob papers are in English only.</li>
            <li><b>Stay on the test.</b> The test uses your whole screen. {INTEGRITY_RULES[0]} {INTEGRITY_RULES[2]}</li>
            {hasMarking ? <li><b>Marking.</b> {signed(right)} for a right answer, {signed(wrong)} for a wrong one, {blank} for a question not answered. You see your score after you submit, never during the test.</li> : null}
            <li><b>Screen.</b> {screen === 'mockmob'
              ? 'This test opens in the MockMob screen, where an answer is saved the moment you choose it. Switch to NTA style at the top of the test to practise the real screen.'
              : 'This test opens in NTA style. The switch at the top of the test changes to the MockMob screen at any time; there, an answer is saved the moment you choose it.'}</li>
          </ul>
        </section>

        <div className="nta-ins__declare">
          <label className="nta-ins__tick" htmlFor={tickId}>
            <input id={tickId} type="checkbox" checked={ready} onChange={(event) => setReady(event.target.checked)} aria-describedby={hintId} />
            <span>I have read and understood the instructions. I am ready to begin.</span>
          </label>
          <button type="button" className="nta-ins__start" onClick={start} disabled={!ready || starting} aria-describedby={hintId}>
            {starting ? 'Starting...' : 'Start the test'}
          </button>
          <p className="nta-ins__hint" id={hintId}>{ready ? `Your ${minutes} minutes start when you press Start the test.` : 'Tick the box above to start.'}</p>
        </div>
      </div>
    </div>
  );
}
