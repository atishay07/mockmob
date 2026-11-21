'use client';

// Development-only harness for one row story of the home page's one-place frame (owner LK365, 21 Nov 2026). It plays a
// story the way the frame will: the story's own component on a stage, worked by the demo cursor (demo/CursorDemo.jsx), with
// the beat's line shown above it. A story is { title, steps } (a pure .mjs file) plus its component. Each lane's preview
// page (src/app/preview/story-<id>/page.jsx) renders <StoryPreview title steps><TheStory /></StoryPreview>.
// The frame itself (OnePlace.jsx) has its own caption strip; this file is never part of the home page.
import { useCallback, useState } from 'react';
import CursorDemo from '../demo/CursorDemo';
import './story-preview.css';

export const sayCount = (steps = []) => steps.filter((step) => typeof step.say === 'string').length;

export default function StoryPreview({ title, steps, children }) {
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [line, setLine] = useState({ text: '', beat: -1 });
  const [state, setState] = useState('playing');
  const beats = sayCount(steps);
  const onSay = useCallback((text, beat) => setLine({ text, beat }), []);
  const replay = () => { setLine({ text: '', beat: -1 }); setState('playing'); setPlaying(true); setRun((n) => n + 1); };
  return (
    <div className="stp" data-state={state}>
      <div className="stp__head">
        <h3 className="stp__title">{title}</h3>
        <button type="button" className="stp__replay" onClick={replay}>Replay</button>
      </div>
      <p className="stp__say" data-beat={line.beat}>
        <span className="stp__dots" aria-hidden="true">{Array.from({ length: beats }, (_, i) => <i key={i} data-on={i === line.beat || undefined} data-done={i < line.beat || undefined} />)}</span>
        <span className="stp__line" key={`${run}-${line.beat}`}>{line.text}</span>
      </p>
      <CursorDemo key={run} steps={steps} playing={playing} onSay={onSay} className="stp__stage"
        onDone={() => { setState('done'); setPlaying(false); }} onTakeover={() => { setState('taken'); setPlaying(false); }}>
        {children}
      </CursorDemo>
      <p className="stp__state">State: {state}. Beats: {beats}.</p>
    </div>
  );
}
