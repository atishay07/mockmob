"use client";

import React, { useCallback, useRef, useState } from 'react';
import { voteOnQuestion } from '@/lib/services/questionService';

export function VoteControls({
  questionId,
  initialScore = 0,
  initialUserVote = null,
  compact = false,
  onVoteApplied,
}) {
  const [score, setScore] = useState(Number(initialScore || 0));
  const [userVote, setUserVote] = useState(initialUserVote);
  const [pending, setPending] = useState(false);
  const inflightRef = useRef(false);

  const applyVote = useCallback(async (requestedVote) => {
    if (!questionId || inflightRef.current) return;

    const prevVote = userVote;
    const prevScore = score;
    const nextVote = requestedVote === userVote ? null : requestedVote;
    const delta = voteDelta(prevVote, nextVote);

    inflightRef.current = true;
    setPending(true);
    setUserVote(nextVote);
    setScore(prevScore + delta);

    try {
      const result = await voteOnQuestion(questionId, nextVote);
      setScore(result.score || 0);
      setUserVote(result.userVote || null);
      onVoteApplied?.(result);
    } catch (e) {
      setUserVote(prevVote);
      setScore(prevScore);
      console.warn('[vote] failed:', e?.message || e);
    } finally {
      inflightRef.current = false;
      setPending(false);
    }
  }, [questionId, score, userVote, onVoteApplied]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        background: 'rgba(255,255,255,.04)',
        borderRadius: '24px',
        padding: compact ? '3px' : '4px',
        opacity: pending ? 0.72 : 1,
      }}
      aria-label="Question voting"
    >
      <VoteButton
        label="Upvote"
        active={userVote === 'up'}
        activeColor="#000"
        activeBg="var(--volt)"
        disabled={pending}
        onClick={() => applyVote('up')}
      >
        ▲
      </VoteButton>
      <span
        style={{
          minWidth: compact ? '24px' : '30px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: compact ? '10px' : '11px',
          color: score > 0 ? 'var(--volt)' : score < 0 ? '#f87171' : '#71717a',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score > 0 ? `+${score}` : score}
      </span>
      <VoteButton
        label="Downvote"
        active={userVote === 'down'}
        activeColor="#fff"
        activeBg="rgba(248,113,113,.4)"
        disabled={pending}
        onClick={() => applyVote('down')}
      >
        ▼
      </VoteButton>
    </div>
  );
}

function voteDelta(from, to) {
  const value = (vote) => vote === 'up' ? 1 : vote === 'down' ? -1 : 0;
  return value(to) - value(from);
}

function VoteButton({ children, label, onClick, active, activeBg, activeColor, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: '20px',
        padding: 0,
        width: '32px',
        height: '32px',
        minWidth: '32px',
        background: active ? activeBg : 'transparent',
        color: active ? activeColor : '#71717a',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '14px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all .15s ease',
      }}
    >
      {children}
    </button>
  );
}
