"use client";
// Review, Papers (LEARN-REVIEW-1017 5.7). No next-move panel here. Per subject with two papers of one kind, a text pair
// (the newest mark as a display numeral, the one before in a sentence); from the third paper the record's trend line draws
// itself (RecordGlimpse's PaperTrend, HTML labels). The record finding is a plain sentence with its source, no side stripe.
// Then every paper, newest first, with its time (F17), its mistakes and repairs, and its score; and the across-papers rows.
import Link from 'next/link';
import RecordGlimpse from '@/components/ai/RecordGlimpse';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { NEXT_MOVE_RULES } from '@/../data/result_next_move.mjs';
import { shortDate } from '@/../data/review_input.mjs';
import { subjectId } from './ChapterRows';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const KIND_WORDS = { 'full mock': 'mocks', 'NTA paper': 'NTA papers', 'smart practice': 'smart practice sets', practice: 'practice sets' };

export function Pair({ papers, bare = false }) {
  // The biggest same-kind group of exactly two papers; three or more get the trend line instead.
  const groups = new Map();
  for (const p of papers) {
    const key = `${p.subject}|${p.kind}|${p.of}`;
    groups.set(key, [...(groups.get(key) || []), p]);
  }
  const pair = [...groups.values()].find((g) => g.length === 2);
  if (!pair) return null;
  const [now, before] = pair;
  const diff = (Number(now.score) || 0) - (Number(before.score) || 0);
  const move = diff > 0 ? `Up ${plural(diff, 'mark')}.` : diff < 0 ? `Down ${plural(-diff, 'mark')}.` : 'The same marks.';
  // Review 1018 (Your papers, N14): the text pair in one line, "158 in Mock 3, Accountancy. Up 18 on 140 in Mock 2."
  if (bare) {
    const on = diff > 0 ? `Up ${diff} on` : diff < 0 ? `Down ${-diff} on` : 'The same as';
    return (
      <p className="rv8-pair"><b>{now.score}</b>in {now.name}, {now.subjectName || now.subject}. {on} {before.score} in {before.name}. A trend line appears from your third {now.kind === 'full mock' ? 'mock' : 'paper'}.</p>
    );
  }
  return (
    <section className="rvw-pairsec" aria-labelledby="rvw-pair-h">
      <div className="rvw-sechead"><h2 id="rvw-pair-h" className="rvw-h2">{now.subjectName || now.subject} {KIND_WORDS[now.kind] || 'papers'}</h2><span>Marks out of {now.of}</span></div>
      <p className="rvw-pair"><b>{now.score}</b><span>in {now.name}, {shortDate(now.at)}</span></p>
      <p className="rvw-pair__note">{before.score} in {before.name}, {shortDate(before.at)}. {move} A trend line appears from your third {now.kind === 'full mock' ? 'mock' : 'paper'}.</p>
    </section>
  );
}

function whereMarksGo(items, lost, papers) {
  const by = new Map();
  for (const i of items) {
    if (i.keyState) continue;
    by.set(i.chapter, (by.get(i.chapter) || 0) + (i.state === 'blank' ? NEXT_MOVE_RULES.gapBlank : NEXT_MOVE_RULES.gapWrong));
  }
  const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (!top.length || !lost) return 'Which chapters your lost marks came from, across your papers.';
  const names = top.map(([n]) => n);
  const sum = top.reduce((s, [, m]) => s + m, 0);
  return `${names.join(' and ')} cost ${sum} of the ${lost} marks you lost across ${plural(papers, 'paper')}.`;
}

export default function PapersView({ body }) {
  const papers = body.papers || [];
  const items = body.items || [];
  const repairedIn = (id) => items.filter((i) => i.paper === id && ['repaired', 'held', 'slipped'].includes(i.state)).length;
  return (
    <div className="rvw-papers">
      <div className="rvw-papers__main">
        <Pair papers={papers} />
        <div className="rvw-finding"><RecordGlimpse /></div>
        <section aria-labelledby="rvw-papers-h">
          <div className="rvw-sechead"><h2 id="rvw-papers-h" className="rvw-h2">Your {plural(papers.length, 'paper')}</h2><span>Newest first</span></div>
          <ul className="rvw-plist">
            {papers.map((p) => (
              <li key={p.id}>
                <Link className="rvw-paper mk-press" href={`/result/${encodeURIComponent(p.id)}`}>
                  <span className="rvw-ch__obj" aria-hidden="true"><SubjectObject id={subjectId(p.subject)} size={48} framed={false} /></span>
                  <b>{p.name}, {p.subjectName || p.subject}</b>
                  <span className="rvw-paper__score">{p.score}<small>of {p.of}</small></span>
                  <span className="rvw-paper__meta">{p.when}. {plural(Number(p.wrong) || 0, 'mistake')}, {repairedIn(p.id)} repaired</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="rvw-across" aria-labelledby="rvw-across-h">
        <h2 id="rvw-across-h" className="rvw-h2">Across your papers</h2>
        <Link className="rvw-row mk-press" href="/analytics">
          <b>Where your marks go</b>
          <span>{whereMarksGo(items, body.counts?.lost, papers.length)}</span>
          <i className="rvw-chev" aria-hidden="true" />
        </Link>
        <Link className="rvw-row mk-press" href="/review/rules">
          <b>Your traps across mocks</b>
          <span>The named traps you fell for across your mocks, in your Rule book.</span>
          <i className="rvw-chev" aria-hidden="true" />
        </Link>
        <Link className="rvw-row mk-press" href="/progress">
          <b>Progress</b>
          <span>Study days this week, concept checks and your playbook.</span>
          <i className="rvw-chev" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
