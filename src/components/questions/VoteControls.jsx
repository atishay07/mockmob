"use client";

import { useCallback, useRef, useState } from 'react';
import { AppIcon } from '@/components/ui/Glyph';
import { voteOnQuestion } from '@/lib/services/questionService';

export function VoteControls({ questionId, initialScore = 0, initialUserVote = null, compact = false, onVoteApplied, onError }) {
  const [score, setScore] = useState(Number(initialScore || 0));
  const [userVote, setUserVote] = useState(initialUserVote);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inflight = useRef(false);
  const applyVote = useCallback(async (requestedVote) => {
    if (!questionId || inflight.current) return;
    const previousVote = userVote;
    const previousScore = score;
    const nextVote = requestedVote === userVote ? null : requestedVote;
    const value = (vote) => vote === 'up' ? 1 : vote === 'down' ? -1 : 0;
    inflight.current = true;
    setPending(true);
    setFailed(false);
    setUserVote(nextVote);
    setScore(score + value(nextVote) - value(userVote));
    try {
      const result = await voteOnQuestion(questionId, nextVote);
      setScore(result.score || 0);
      setUserVote(result.userVote || null);
      onVoteApplied?.(result);
    } catch (error) {
      setUserVote(previousVote);
      setScore(previousScore);
      setFailed(true);
      onError?.(error);
    } finally { inflight.current = false; setPending(false); }
  }, [questionId, score, userVote, onVoteApplied, onError]);

  return <div className={`question-vote ${compact ? 'question-vote--compact' : ''}`}>
    <div className="question-vote__controls" aria-label="Question voting" aria-busy={pending}>
      <button type="button" aria-label="Upvote" aria-pressed={userVote === 'up'} disabled={pending} onClick={() => applyVote('up')}><AppIcon name="collapse" size={16} /></button>
      <span className="question-vote__score" aria-label={`Vote score: ${score}`}>{score > 0 ? `+${score}` : score}</span>
      <button type="button" aria-label="Downvote" aria-pressed={userVote === 'down'} disabled={pending} onClick={() => applyVote('down')}><AppIcon name="expand" size={16} /></button>
    </div>
    {failed && !onError && <span className="question-vote__error" role="status">Vote did not save.</span>}
  </div>;
}