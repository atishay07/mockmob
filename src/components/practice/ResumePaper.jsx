"use client";

// "Resume your paper" (15 Nov 2026, bugs-core B2b). A practice paper lives on this device until it is sent, so one left by
// the phone's Back, a closed tab or another app is found here: one quiet row per paper with its set, answered of total and
// the time left, and one key. It is gone when the timer and the 2-minute upload grace are over. No volt: the page's own
// Start stays its one volt key. Practice and Today mount it; the rules are src/lib/paper/resume.mjs.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { livePapers, resumeCopy } from '@/lib/paper/resume.mjs';
import { storedDrafts } from '@/lib/paper/draft.mjs';
import './resume-paper.css';

const TICK_MS = 15000;

function read(userId) {
  if (!userId || typeof window === 'undefined') return [];
  try { return livePapers(storedDrafts(window.localStorage, userId), userId, Date.now()); } catch { return []; }
}

export default function ResumePaper({ className = '' }) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    if (!userId) return undefined;
    const refresh = () => setPapers(read(userId));
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, TICK_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  if (!papers.length) return null;
  return (
    <section className={`rsp ${className}`.trim()} aria-label={papers.length === 1 ? 'Your open paper' : 'Your open papers'}>
      {papers.map((paper) => {
        const copy = resumeCopy(paper);
        return (
          <Link key={paper.key} href={paper.href} className="rsp__row" aria-label={copy.label} data-state={paper.state}>
            <span className="rsp__text">
              <b>{copy.title}</b>
              <span>{copy.line}</span>
            </span>
            <span className="rsp__key" aria-hidden="true">{copy.key}</span>
          </Link>
        );
      })}
    </section>
  );
}
