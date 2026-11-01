'use client';
// The run's end (A4-chapter-run.md 3.4 as amended by R2 ruling 5, LK31; the same form as the feed's end): the chapter as a
// quiet line, the headline with Mobi beside it, the cards this run sent to Revise as a small fan, one row of up to three
// numbers (zeros dropped), the chapter's progress bar growing, one main key and at most one quiet text link. The X is the
// only other way out. Free after the day's session: one line with See Pro inline, a main key that still works today, and
// "Questions on this chapter" (Explore questions stay free); never a key the server would refuse.
// Every word and number comes from GET /api/learn/runs/:id/end.
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { EndKey, EndScreen } from '../stage/EndForm';
import { FREE_END_LINE, endHeadline, endNumbers, endProgress, reviseLabel } from '../stage/endModel.mjs';
import { endAct } from './runMath';
import { endTitle, reviseSummary } from './runView.mjs';

function hrefOf(option, links) {
  if (!option) return null;
  if (option.href) return links.resolve ? links.resolve(option.href) : option.href;
  const run = option.run;
  if (!run) return null;
  if (run.kind === 'feed') return links.feed(run.chapterKey, run.minutes || 10);
  return links.run({ chapterKey: run.chapterKey || null, minutes: run.minutes || 10, kind: run.kind || 'mix', leaveOut: run.leaveOut || [], cardIds: run.cardIds || [] });
}

const minutesOf = (o) => Number(o?.minutes) || Number(o?.run?.minutes) || null;

/** The main key's words: "Next chapter, 10 min" over the chapter's name; else the option's own title with its minutes. */
export function mainWords(option) {
  if (!option) return null;
  const m = minutesOf(option);
  const title = String(option.title || option.label || '').trim();
  if (option.kind === 'next' && /^Next: /.test(title)) return { label: `Next chapter${m ? `, ${m} min` : ''}`, sub: title.replace(/^Next: /, '') };
  if (option.kind === 'recap') return { label: `Quick recap${m ? `, ${m} min` : ''}`, sub: null };
  const hasMinutes = /\bminutes?\b|\bmin\b/.test(title);
  return { label: m && !hasMinutes ? `${title}, ${m} min` : title, sub: option.kind === 'next' ? option.evidence || null : null };
}

/** The quiet link's words: "Fix 1 open mistake, 2 min", "Another 5 minutes here", "Questions on this chapter". */
export function quietWords(option) {
  if (!option) return null;
  if (option.kind === 'explore') return 'Questions on this chapter';
  const m = minutesOf(option);
  const title = String(option.title || option.label || '').trim();
  if (option.kind === 'mock') return title;
  return m && !/\bminutes?\b|\bmin\b/.test(title) ? `${title}, ${m} min` : title;
}

export default function RunEnd({ state, tally, kind = 'mix', chapter = {}, closeHref, links, onRetry, stoppedAt = null, total = null }) {
  const headRef = useRef(null);
  useEffect(() => { if (state.status === 'ready') headRef.current?.focus({ preventScroll: true }); }, [state.status]);
  const close = <Link href={closeHref} className="lr-close lr-close--end" aria-label="Close"><X size={22} strokeWidth={2.2} aria-hidden="true" /><span className="lr-close__word">Close</span></Link>;
  if (state.status === 'loading' || state.status === 'idle') return <EndScreen close={close} loading />;
  if (state.status === 'error' || !state.data) {
    return (
      <EndScreen close={close} titleRef={headRef} onRetry={onRetry}
        error={{ title: 'Your run is saved', line: 'Its summary did not load. Every rating and answer is already in.' }} />
    );
  }
  const d = state.data;
  const runKind = d.kind || kind;
  const name = d.chapter?.title || endTitle(d.title || chapter.title, { kind: runKind }).name || chapter.title || null;
  const done = d.done || (total ? { reached: stoppedAt ?? total, of: total, minutes: null } : null);
  const headline = runKind === 'recap' ? 'Quick recap done' : endHeadline({ ...(done || {}), stopped: Boolean(d.stopped) || (stoppedAt !== null && done && stoppedAt < done.of) });
  const hasCards = runKind !== 'level' && runKind !== 'recap';
  const sent = hasCards ? (reviseSummary(d.revisePile).total || (d.reviseCards || []).length) : 0;
  const qLine = (d.lines || []).find((l) => l.label === 'Questions')?.text || '';
  const right = Number((qLine.match(/^(\d+) of/) || [])[1]) || 0;
  const numbers = endNumbers({
    revise: sent, reviseText: reviseLabel(d.revisePile),
    answered: Number(d.numbers?.questions) || 0, right,
    mistakes: Number(d.numbers?.mistakes) || 0, fixed: Number(d.numbers?.fixed) || 0,
  });
  const progress = hasCards ? endProgress(d.progress) : null;
  const act = endAct(tally) || 'nod';
  const options = (d.options || []).filter((o) => hrefOf(o, links));
  const free = d.lead?.go === 'pro' || (d.lead?.line && !d.lead?.run);
  let main = null;
  let quiet = null;
  let freeLine = null;
  const seePro = (e) => openUpgrade({ trigger: 'learn', opener: e?.currentTarget });
  if (free) {
    // Free after the day's session: a key that still works today (a recap or due cards), then Explore's free questions.
    const first = options.find((o) => o.kind === 'recap' || o.kind === 'revise') || null;
    const explore = options.find((o) => o.kind === 'explore') || null;
    if (first) {
      const w = mainWords(first);
      main = <EndKey as={Link} href={hrefOf(first, links)} sub={w.sub}>{w.label}</EndKey>;
      freeLine = { line: FREE_END_LINE, onSeePro: seePro };
    } else {
      main = <EndKey onClick={seePro}>See Pro</EndKey>;
      freeLine = { line: FREE_END_LINE.split('. ')[0] + '.', onSeePro: null };
    }
    if (explore) quiet = <Link className="lr-textkey" href={hrefOf(explore, links)}>{first ? quietWords(explore) : 'Answer single questions'}</Link>;
  } else {
    const lead = d.lead && hrefOf(d.lead, links) ? d.lead : options[0] || null;
    const extra = options.find((o) => o !== lead) || null;
    if (lead) {
      const w = mainWords(lead);
      main = <EndKey as={Link} href={hrefOf(lead, links)} sub={w.sub || (d.level && runKind === 'level' ? `Your lowest score: ${d.level.right} of ${d.level.of} right` : null)}>{w.label}</EndKey>;
    }
    if (extra) quiet = <Link className="lr-textkey" href={hrefOf(extra, links)}>{quietWords(extra)}</Link>;
  }
  return (
    <EndScreen close={close} titleRef={headRef} chapter={name} headline={headline} mobi={act}
      pile={sent ? d.reviseCards || [] : null} numbers={numbers} progress={progress}
      free={freeLine} main={main} quiet={quiet} />
  );
}
