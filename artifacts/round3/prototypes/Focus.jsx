'use client';
import { useState } from 'react';
import StudyQuestion from './StudyQuestion';
export default function Focus({ questions }) {
  const [index, setIndex] = useState(0);
  return <div className="studio-focus"><div className="studio-focus__position"><span>One at a time</span><b>{index + 1} / {questions.length}</b></div><StudyQuestion key={questions[index].id} question={questions[index]} /><nav aria-label="Move between questions"><button disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button><button disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}>Next question →</button></nav><p>A focused deck. Less context switching, but it adds navigation to every question.</p></div>;
}
