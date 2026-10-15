"use client";
// Review's way into Revise (feature wave F1; spec tmp/mistake-lab-v4/SPEC.md 4.8): "Revise: 6 due today. 31 cards, 4 recalled
// twice." from GET /api/me/revise. Revise opens in its own page. While it loads the entry still opens Revise; when the
// server says it is unavailable (no table yet) or the read fails, the entry hides itself, so nothing points at a dead page.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useRevise } from './useRevise';
import './revise.css';

export default function ReviseEntry() {
  const read = useRevise({ cap: 10 });
  if (read.state === 'unavailable' || read.state === 'error') return null;
  const data = read.state === 'ready' ? read.data : null;
  // A student with no card yet has nothing to open: the page would say so, and the entry stays out of the way.
  if (data?.state === 'empty') return null;
  const detail = data?.summary || 'Questions you got wrong come back after 1, 3, 7 and 21 days.';
  return (
    <Link className="rv-entry" href="/review/revise" data-state={read.state}>
      <span className="rv-entry__text">
        <b>{data ? data.head : 'Revise'}</b>
        <span>{detail}</span>
      </span>
      <ArrowRight className="rv-entry__go" size={18} aria-hidden="true" />
    </Link>
  );
}
