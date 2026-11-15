"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ArenaPreviewClient from '../ArenaPreviewClient';
import { AuthContext } from '@/components/AuthProvider';
import ResumePaper from '@/components/practice/ResumePaper';

const USER = 'preview-user';

function seed() {
  const now = Date.now();
  const paper = (key, over) => ({
    v: 2, selectionMeta: { sessionId: `preview-${key}` }, generationKey: key, startedAt: now - 60000, idx: 0, events: [],
    questions: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` })), answers: { q0: 1, q1: 2, q2: 0, q3: 3, q4: 1, q5: 2 },
    paper: { href: `/test?subject=accountancy&count=10&mode=quick&generationKey=${key}`, subject: 'Accountancy', mode: 'Quick practice' }, ...over,
  });
  try {
    window.localStorage.setItem(`mm:test:${USER}:paper:g.preview-seed-000001`, JSON.stringify(paper('preview-seed-000001', { endsAt: now + 12 * 60000 + 20000 })));
    window.localStorage.setItem(`mm:test:${USER}:paper:g.preview-seed-000002`, JSON.stringify(paper('preview-seed-000002', { endsAt: now - 30000, answers: { q0: 1, q1: 2, q2: 0 }, paper: { href: '/test?subject=economics&count=50&mode=full&generationKey=preview-seed-000002', subject: 'Economics', mode: 'Full mock' } })));
  } catch { /* storage blocked */ }
}

// Practice's page, with the row portalled in under its heading (the mount the runner lane recommends).
export default function ResumePreview() {
  const [slot, setSlot] = useState(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('seed') === '1') seed();
    let tries = 0;
    const find = () => {
      const head = document.querySelector('.pr-head');
      if (head) {
        const box = document.createElement('div');
        head.insertAdjacentElement('afterend', box);
        setSlot(box);
        return;
      }
      if ((tries += 1) < 40) window.setTimeout(find, 150);
    };
    find();
  }, []);
  return (
    <>
      <ArenaPreviewClient candidatePathway={null} />
      {slot ? createPortal(<AuthContext.Provider value={{ user: { id: USER } }}><ResumePaper /></AuthContext.Provider>, slot) : null}
    </>
  );
}
