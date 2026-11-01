'use client';
// The run's end (A4-chapter-run.md 3.4 as amended by R2 ruling 5, LK31 and R3-SPEC L5; the same form as the feed's end): the
// chapter as a quiet line, the headline with Mobi beside it, the cards this run sent to Revise as a small fan, one row of up
// to three numbers (zeros dropped), the chapter's progress bar growing, then the key group: Free's one line when the day's
// session is used, one main key and at most one quiet link. The X is the only other way out.
// The keys are the server's (GET /api/learn/runs/:id/end, data/learn/suggest.js endOptions), word for word (ruling W):
//   "Keep going · 10 min" / "Next chapter · 10 min" over the chapter's name; quiet "Fix 3 open mistakes · 3 min"
//   a stopped run: "Continue · 6 min" resumes it by its id; the fix key starts a NEW mistakes-only run (`fresh`)
//   Free after the day's session: "Quick recap · 1 min" (or See Pro), See Pro quiet; never a key the server would refuse
// A key that starts a chapter run starts it here (onStart, the player's own params); a feed or a page is a link.
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { EndKey, EndScreen } from '../stage/EndForm';
import { endHeadline, endNumbers, endProgress, reviseLabel } from '../stage/endModel.mjs';
import { endAct } from './runMath';
import { endTitle, reviseSummary } from './runView.mjs';

/** Where a key goes: { href } for a page or a feed, { run } for a chapter run started in place, { pro } for See Pro. */
export function keyTarget(option, links) {
  if (!option) return null;
  if (option.go === 'pro') return { pro: true };
  if (option.href) return { href: links.resolve ? links.resolve(option.href) : option.href };
  const run = option.run;
  if (!run) return null;
  if (run.kind === 'feed') return { href: links.feed(run.chapterKey, run.minutes || 10, { runId: run.resume || null }) };
  return { run };
}

export default function RunEnd({ state, tally, kind = 'mix', chapter = {}, closeHref, links, onRetry, onStart, stoppedAt = null, total = null }) {
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
  const stopped = Boolean(d.stopped) || (stoppedAt !== null && done && stoppedAt < done.of);
  const headline = runKind === 'recap' ? 'Quick recap done' : endHeadline({ ...(done || {}), stopped });
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
  const seePro = (e) => openUpgrade({ trigger: 'learn', opener: e?.currentTarget });
  const lead = d.lead && keyTarget(d.lead, links) ? d.lead : null;
  const quietOption = (d.options || []).find((o) => o !== lead && keyTarget(o, links)) || null;
  const keyOf = (option, main) => {
    const to = keyTarget(option, links);
    const label = option.label || option.title;
    const sub = main ? (option.kind === 'next' ? option.chapterTitle || null : runKind === 'level' && d.level ? `Your lowest score: ${d.level.right} of ${d.level.of} right` : null) : null;
    if (main) {
      if (to.pro) return <EndKey onClick={seePro}>{label}</EndKey>;
      if (to.href) return <EndKey as={Link} href={to.href} sub={sub}>{label}</EndKey>;
      return <EndKey onClick={() => onStart?.(to.run)} sub={sub}>{label}</EndKey>;
    }
    if (to.pro) return <button type="button" className="lr-textkey" onClick={seePro}>{label}</button>;
    if (to.href) return <Link className="lr-textkey" href={to.href}>{label}</Link>;
    return <button type="button" className="lr-textkey" onClick={() => onStart?.(to.run)}>{label}</button>;
  };
  return (
    <EndScreen close={close} titleRef={headRef} chapter={name} headline={headline} mobi={act}
      pile={sent ? d.reviseCards || [] : null} numbers={numbers} progress={progress}
      free={d.lead?.line ? { line: d.lead.line } : null}
      main={lead ? keyOf(lead, true) : null} quiet={quietOption ? keyOf(quietOption, false) : null} />
  );
}
