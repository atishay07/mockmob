'use client';
// Free after the day's session, the start refused (R3-SPEC ruling F; the feed's 402, and the run's on a second tab). The same
// block as Learn home's Free-done state, word for word:
//   headline  FREE_DONE_HEADLINE ("That was today's free session.")
//   line      FREE_DONE_LINE ("Questions come back tomorrow. Your Key cards stay open.")
//   main key  See Pro
//   Or rows   up to 2 quiet rows, in this order, only those that apply:
//               1. "Continue · N min"            today's own unfinished run (the 402's `resume`)
//               2. "Revise N due cards · M min"  due > 0 (a cards run, never counted)
//               3. "Answer single questions"     Explore stays free
// Every row is a key the server accepts today. Close (the X above it) returns to where the student came from.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { FREE_DONE_HEADLINE, FREE_DONE_LINE } from '../../../../data/learn/allowance.js';
import { WORDS } from '../../../../data/learn/words.js';
import { freeUsedRows } from './endModel.mjs';
import { seePro } from './Stage';

export default function FreeUsed({ data = {}, links, chapterKey = null, minutes = 10 }) {
  const router = useRouter();
  const r = data.resume || null;
  const options = Array.isArray(data.options) ? data.options : [];
  const revise = options.find((o) => o.run?.kind === 'cards') || null;
  const explore = options.find((o) => o.href && o.go === 'explore') || null;
  const hrefOf = {
    continue: r ? (r.kind === 'feed' ? links.feed(r.chapterKey, minutes, { runId: r.id }) : links.run({ chapterKey: r.chapterKey, runId: r.id })) : null,
    revise: revise ? links.run({ chapterKey: revise.run.chapterKey || chapterKey, minutes: revise.run.minutes, kind: 'cards', cardIds: revise.run.cardIds || [] }) : null,
    singles: explore ? (links.resolve ? links.resolve(explore.href) : explore.href) : links.explore(),
  };
  const rows = freeUsedRows(data).filter((row) => hrefOf[row.id]);
  return (
    <div className="st-free">
      <h1 className="st-free__h">{FREE_DONE_HEADLINE}</h1>
      <p className="st-free__p">{FREE_DONE_LINE}</p>
      <div className="st-free__keys">
        <button type="button" className="kc-btn kc-btn--volt st-endx__main" data-page-primary="" onClick={(e) => seePro('learn', e.currentTarget, router.push)}>
          <span className="st-endx__mainl">{WORDS.seePro}</span>
        </button>
      </div>
      {rows.length ? (
        <div className="st-free__or">
          <p className="st-free__orl">Or</p>
          <ul className="st-free__rows">
            {rows.map((row) => (
              <li key={row.id}>
                <Link className="st-free__row" href={hrefOf[row.id]}>
                  <span>{row.label}</span>
                  <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
