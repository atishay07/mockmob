'use client';
import { useState } from 'react';
import StudyQuestion from './StudyQuestion';
export default function Chapters({ questions }) {
  const chapters = [...new Set(questions.map((question) => question.chapter))];
  const [selected, setSelected] = useState(chapters[0]);
  const current = chapters.includes(selected) ? selected : chapters[0];
  return <div className="studio-chapters"><nav aria-label="Chapter lanes">{chapters.map((chapter) => <button key={chapter} aria-pressed={current === chapter} onClick={() => setSelected(chapter)}><small>Chapter lane</small><b>{chapter}</b><span>{questions.filter((question) => question.chapter === chapter).length} illustrative questions →</span></button>)}</nav><section aria-label={current}><h2>{current}</h2>{questions.filter((question) => question.chapter === current).slice(0,3).map((question) => <StudyQuestion key={question.id} question={question} />)}</section></div>;
}
