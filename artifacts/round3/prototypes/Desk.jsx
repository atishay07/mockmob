'use client';
import { useState } from 'react';
import StudyQuestion from './StudyQuestion';
export default function Desk({ questions }) {
  const [count, setCount] = useState(2);
  return <div className="studio-desk"><div>{questions.slice(0,count).map((question) => <StudyQuestion key={question.id} question={question} />)}{count < questions.length ? <button className="studio-action" onClick={() => setCount(count + 2)}>Load more questions</button> : <p role="status">You’re up to date for these filters.</p>}</div><aside><small>Tonight’s rule</small><h2>Answer first.<br />Then ask why.</h2><p>Browse, compare explanations and keep useful questions close.</p><p>Chosen direction: a workbench with native filters and quiet solve-in-place cards.</p></aside></div>;
}
