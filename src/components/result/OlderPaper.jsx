"use client";
// What an older paper cannot show, in one line, and the one way to get it (spec: tmp/mistake-lab-v4/SPEC.md 4.1 basic
// state; CEO decision 16 Oct: the Lab must not look broken or empty on a paper taken before the clock was kept).
// The server sends `lab.older` (data/mistake_lab.js olderPaper): { reason, line, action: { label, href } }. The line
// and the label come finished, so the website and the app say the same words. The action opens the existing practice
// setup on this paper's subject with a Full mock, where its cost is shown before anything starts. It is a quiet
// outlined link: the repair key stays the only filled button on the page.
import Link from 'next/link';
import './older-paper.css';

export default function OlderPaper({ older }) {
  if (!older?.line) return null;
  const href = typeof older.action?.href === 'string' && older.action.href.startsWith('/') ? older.action.href : null;
  return (
    <div className="ol" data-reason={older.reason || undefined}>
      <p className="ol-line">{older.line}</p>
      {href && older.action?.label ? <Link className="srl-cta srl-cta--quiet ol-action" href={href}>{older.action.label}</Link> : null}
    </div>
  );
}
