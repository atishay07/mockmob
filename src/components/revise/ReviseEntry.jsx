"use client";
// Review's way into Revise (feature wave F1; spec tmp/mistake-lab-v4/SPEC.md 4.8): "6 questions to revise today" over
// "31 questions in rotation, 4 recalled twice." (the head already says what is due, so the line does not repeat it) from GET /api/me/revise. Revise opens in its own page. While it loads the entry still opens Revise; when the
// server says it is unavailable (no table yet) or the read fails, the entry hides itself, so nothing points at a dead page.
import Link from 'next/link';
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
    <Link className="rvs-entry" href="/review/revise" data-state={read.state}>
      <span className="rvs-entry__text">
        <b>{data ? data.head : 'Revise'}</b>
        <span>{detail}</span>
      </span>
    </Link>
  );
}
