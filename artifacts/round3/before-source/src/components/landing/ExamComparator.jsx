"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Clock3, Monitor, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const QUESTIONS = [
  { text: 'Choose the option nearest in meaning to CANDID:', options: ['Hidden', 'Frank', 'Careful', 'Sweet'] },
  { text: 'Choose the correctly spelt word:', options: ['Accomodate', 'Acommodate', 'Accommodate', 'Accommadate'] },
  { text: 'Choose the opposite of ABUNDANT:', options: ['Plentiful', 'Scarce', 'Ample', 'Generous'] },
  { text: 'Complete the sentence: Neither of the answers ___ correct.', options: ['are', 'were', 'is', 'have'] },
  { text: 'Choose the meaning of “a blessing in disguise”:', options: ['An unexpected benefit', 'An obvious problem', 'A secret promise', 'A hurried decision'] },
];
const LEGEND = [['unseen', 'Not visited'], ['skipped', 'Not answered'], ['answered', 'Answered'], ['review', 'Marked for review'], ['review-answered', 'Answered & marked for review']];

export function ExamComparator() {
  const { user } = useAuth();
  const [mode, setMode] = useState('mockmob');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState({});
  const [visited, setVisited] = useState({ 0: true });
  const [notice, setNotice] = useState('Try an answer, then switch interfaces. Your choices stay with you.');
  const question = QUESTIONS[index];
  const classic = mode === 'nta';
  function stateFor(i) {
    if (review[i]) return answers[i] !== undefined ? 'review-answered' : 'review';
    if (answers[i] !== undefined) return 'answered';
    return visited[i] ? 'skipped' : 'unseen';
  }
  function go(i) { setIndex(i); setVisited((v) => ({ ...v, [i]: true })); }
  function next(mark) {
    setReview((v) => ({ ...v, [index]: mark }));
    if (index < QUESTIONS.length - 1) go(index + 1);
    else setNotice('You’ve reached the last sample. Use the palette to revisit any of the five questions.');
  }
  function reset() {
    setAnswers({}); setReview({}); setVisited({ 0: true }); setIndex(0);
    setNotice('Preview reset. Try an answer, then switch interfaces.');
  }
  return (
    <section className="lp-sec lp-exam-section" id="exam-experience" aria-labelledby="exam-title">
      <div className="mm-wrap">
        <div className="lp-exam-intro">
          <div><h2 className="lp-h2" id="exam-title">Your practice space.<br />Your exam-day rehearsal.</h2>
            <p className="lp-sub">Get comfortable in MockMob. Switch to the familiar NTA-style console when it’s time to rehearse. Same questions. Two ways to focus.</p></div>
          <div className="lp-exam-switch" role="group" aria-label="Preview interface">
            <button type="button" aria-pressed={!classic} onClick={() => setMode('mockmob')}><Sparkles size={17} />MockMob</button>
            <button type="button" aria-pressed={classic} onClick={() => setMode('nta')}><Monitor size={17} />NTA style<span>Pro</span></button>
          </div>
        </div>
        <div className="lp-exam" data-interface={mode}>
          <div className="lp-exam__bar"><span><span className="lp-exam__live" />{classic ? 'CUET practice · NTA-style console' : 'MockMob Arena · English'}</span><span className="lp-exam__sample">Interactive preview</span><span className="lp-exam__clock"><Clock3 size={15} />60:00 <small>demo</small></span></div>
          <div className="lp-exam__body">
            <div className="lp-exam__paper">
              <div className="lp-exam__meta"><span>English</span><span>+5 correct <i /> −1 incorrect</span></div>
              <div className="lp-exam__question" aria-live="polite"><p className="lp-exam__number">Question {index + 1} <span>of 5 sample questions</span></p><h3>{question.text}</h3></div>
              <fieldset className="lp-exam__options"><legend className="lp-sr">Answer for question {index + 1}</legend>
                {question.options.map((option, i) => <label key={`${index}-${i}`} data-selected={answers[index] === i}>
                  <input type="radio" name={`preview-answer-${index}`} checked={answers[index] === i} onChange={() => setAnswers((a) => ({ ...a, [index]: i }))} />
                  <span className="lp-exam__letter" aria-hidden="true">{'ABCD'[i]}</span><span>{option}</span>{answers[index] === i && <Check className="lp-exam__check" size={17} aria-hidden="true" />}
                </label>)}
              </fieldset>
              <div className="lp-exam__actions">
                <button type="button" className="lp-exam__review" onClick={() => next(true)}>Mark for Review & Next</button>
                <button type="button" onClick={() => setAnswers((a) => { const copy = { ...a }; delete copy[index]; return copy; })}>Clear response</button>
                <button type="button" className="lp-exam__save" onClick={() => next(false)}>Save & Next <ArrowRight size={15} /></button>
              </div>
            </div>
            <aside className="lp-exam__palette" aria-label="Preview question palette">
              <div className="lp-exam__palette-heading"><h4>Question Palette</h4><span>{Object.keys(answers).length}/5 answered</span></div>
              <div className="lp-exam__numbers">{Array.from({ length: 50 }, (_, i) => <button key={i} type="button" disabled={i >= 5} data-state={stateFor(i)} aria-current={index === i ? 'step' : undefined} aria-label={`Preview question ${i + 1}, ${LEGEND.find(([s]) => s === stateFor(i))[1]}${i >= 5 ? ', full mock only' : ''}`} onClick={() => go(i)}>{i + 1}</button>)}</div>
              <p className="lp-exam__palette-note">Questions 1–5 are interactive. A full mock has 50.</p>
              <p className="lp-exam__legend-title">Legend</p><ul className="lp-exam__legend">{LEGEND.map(([state, name]) => <li key={state}><span data-state={state} aria-hidden="true">{state === 'review-answered' ? <Check size={10} /> : ''}</span>{name}</li>)}</ul>
            </aside>
          </div>
          <div className="lp-exam__foot"><p role="status">{notice}</p><button type="button" onClick={reset}><RotateCcw size={14} />Reset preview</button></div>
        </div>
        <div className="lp-exam-bottom"><p><Check size={16} />Answers and review flags stay when you switch.<br /><span>Original sample questions. NTA-style practice is independent of NTA; the official CUET 2027 interface may change.</span></p>
          <Link href={user?.isPremium ? `/dashboard?mode=nta&interface=${mode}` : '/pricing'} className="mm-btn mm-btn--primary">{user?.isPremium ? 'Set up an NTA mock' : 'Explore Pro'}<ArrowRight size={17} /></Link></div>
      </div>
    </section>
  );
}
