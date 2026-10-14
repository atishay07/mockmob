'use client';

// The small Mobi that reads beside an opened answer on the result page. When the student opens an
// answer he may react to it once (the app's AnswerReactor, lib/mobiMoments.js answerAct): a wrong or
// blank answer gets encouragement and then a point at the explanation; a right one gets a small
// hop and then he goes back to reading. With no reaction he simply reads.
import { useState } from 'react';
import MobiReact from './MobiReact';

export default function ReaderMobi({ react = null, size = 40 }) {
  const [act, setAct] = useState(react?.first || 'read');
  return <MobiReact act={act} size={size} facing={act === 'point' ? 'left' : 'right'} onDone={() => setAct(react?.then || 'read')} />;
}
