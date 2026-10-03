"use client";

import { memo, useEffect, useRef, useState } from 'react';
import { AppIcon, StatusIcon } from '@/components/ui/Glyph';
import { interactWithQuestion, setQuestionBookmark } from '@/lib/services/questionService';
import { VoteControls } from '@/components/questions/VoteControls';
import { useToast } from '@/components/ToastProvider';
import { questionFeedback } from '@/../data/explore_feed';

export const QuestionCard = memo(function QuestionCard({ row, onProgressChange }) {
  const q = row?.questions ?? row ?? {};
  const options = Array.isArray(q.options) ? q.options : [];
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(Boolean(q.saved));
  const [saving, setSaving] = useState(false);
  const [recordError, setRecordError] = useState(false);
  const card = useRef(null);
  const feedbackNode = useRef(null);
  const seen = useRef(false);
  const startedAt = useRef(null);
  const answerLock = useRef(false);
  const saveLock = useRef(false);
  const feedback = questionFeedback(q, selected);

  useEffect(() => {
    if (!card.current || !q.id) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || seen.current) return;
      seen.current = true;
      startedAt.current = Date.now();
      interactWithQuestion(q.id, { interaction_type: 'seen' }).catch(() => {});
      observer.disconnect();
    }, { threshold: 0.4 });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [q.id]);

  function reveal(key, keyboard) {
    if (answerLock.current) return;
    answerLock.current = true;
    setSelected(key);
    setRevealed(true);
    if (keyboard) requestAnimationFrame(() => feedbackNode.current?.focus({ preventScroll: true }));
    interactWithQuestion(q.id, { interaction_type: key == null ? 'skip' : 'attempted', dwell_ms: Math.max(0, Date.now() - (startedAt.current ?? Date.now())), metadata: key == null ? {} : { selected_key: key } }).then((result) => {
      if (!result) setRecordError(true);
      else onProgressChange?.({ type: key == null ? 'skip' : 'attempted', questionId: q.id });
    }).catch(() => setRecordError(true));
  }

  async function save() {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const result = await setQuestionBookmark(q.id, !saved);
      setSaved(Boolean(result.saved));
      onProgressChange?.({ type: result.saved ? 'save' : 'unsave', questionId: q.id });
      if (result.saved) toast.success({ message: 'Saved for another go.', actionLabel: 'Open saved', href: '/saved' });
    } catch (error) {
      toast.error(error.status === 402 ? 'Your 25 free save slots are full. Remove a saved question to make room.' : 'Could not update saved questions. Check your connection and try again.');
    } finally { saveLock.current = false; setSaving(false); }
  }

  return (
    <article ref={card} className="ex-question">
      <header className="ex-question__meta"><span>{q.chapter || 'Practice question'}</span><span className="ex-difficulty" data-level={q.difficulty}>{['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'Unlabelled'}</span></header>
      <h3 className="ex-question__body">{q.body ?? q.question ?? 'Question unavailable'}</h3>
      <div className="ex-options" role="group" aria-label="Answer options">
        {options.map((option, index) => {
          const correct = revealed && feedback.correctKey != null && String(option.key) === String(feedback.correctKey);
          const wrong = revealed && feedback.state === 'incorrect' && String(option.key) === String(selected);
          return <button key={option.key ?? index} type="button" className="ex-option" data-state={correct ? 'correct' : wrong ? 'wrong' : 'idle'} disabled={revealed || option.key == null || feedback.state === 'unavailable'} onClick={(event) => reveal(option.key, event.detail === 0)}><span className="ex-option__key">{option.key ?? 'ABCD'[index]}</span><span>{option.text}</span>{correct ? <StatusIcon kind="success" size={18} /> : wrong ? <StatusIcon kind="error" size={18} /> : null}</button>;
        })}
      </div>
      {revealed && <div ref={feedbackNode} className="ex-feedback" data-state={feedback.state} tabIndex={-1} role="status"><b>{feedback.state === 'correct' ? 'Correct. Keep the reasoning.' : feedback.state === 'incorrect' ? `The answer is ${feedback.correctKey}. Here’s why.` : feedback.state === 'revealed' ? `Answer: ${feedback.correctKey}` : 'The answer is unavailable.'}</b><p>{q.explanation || 'An explanation is not available for this question.'}</p></div>}
      {recordError && <p className="ex-recorderror" role="status">Feedback is shown, but this activity could not be recorded.</p>}
      {feedback.state === 'unavailable' && !revealed && <p className="ex-recorderror">This question has no usable answer key. Try the next one.</p>}
      <footer className="ex-question__actions">
        <VoteControls questionId={q.id} initialScore={q.score} initialUserVote={q.userVote} onError={() => toast.error('Your vote did not save. Try again when your connection is back.')} />
        <div className="ex-question__tools"><button type="button" className="ex-action" aria-pressed={saved} disabled={saving} onClick={save}><AppIcon name="saved" size={16} />{saving ? 'Saving…' : saved ? 'Saved' : 'Save'}</button>{!revealed && feedback.state !== 'unavailable' && <button type="button" className="ex-action" onClick={(event) => reveal(null, event.detail === 0)}>Show answer</button>}</div>
      </footer>
    </article>
  );
});