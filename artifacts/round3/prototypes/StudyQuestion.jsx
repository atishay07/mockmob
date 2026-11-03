'use client';
import { useState } from 'react';
export default function StudyQuestion({ question }) {
  const [answer, setAnswer] = useState(null);
  const [saved, setSaved] = useState(false);
  const [vote, setVote] = useState(0);
  return <article className="studio-question"><small>{question.chapter} · {question.difficulty}</small><h2>{question.body}</h2><div className="studio-options">{question.options.map((option) => <button key={option.key} disabled={answer !== null} data-correct={answer !== null && option.key === question.correct_answer} data-wrong={answer === option.key && option.key !== question.correct_answer} onClick={() => setAnswer(option.key)}>{option.key}<span>{option.text}</span></button>)}</div>{answer !== null && <div className="studio-feedback" role="status"><b>{answer === question.correct_answer ? 'Correct. Here’s why.' : `The answer is ${question.correct_answer}. Here’s why.`}</b><p>{question.explanation}</p></div>}<footer><button aria-pressed={saved} onClick={() => setSaved(!saved)}>{saved ? 'Saved for this preview' : 'Save'}</button><button aria-pressed={vote === 1} onClick={() => setVote(vote === 1 ? 0 : 1)}>Upvote {vote}</button>{answer === null && <button onClick={() => setAnswer('skip')}>Show answer</button>}</footer></article>;
}
