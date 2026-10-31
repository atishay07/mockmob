'use client';
// The run's end (A4-chapter-run.md 3.4 as amended by BUILD-1101 B2 and B7; the same form as the feed's end, A1 3.9):
//   left    the title ("10 minutes on" or "Stopped at 7 of 21 in", then the chapter), Mobi's one reaction, the chapter's state
//           change as the screen's one authored moment (Pro), the pile of real card faces this run sent to Revise with their
//           return days, and the lines (Key cards, Questions, Old mistakes) without saying a number twice
//   right   what next: the lead (heading, reason, the volt key), up to three options as rows, Back to the chapter
//   Free    after the day's session: the server's line with a See Pro text key at the top of the right column, and the volt
//           goes to the first thing that still works today
// Two columns inside 880 px from 1024 px; one column under it. Every word and number comes from GET /api/learn/runs/:id/end.
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ChevronRight, X } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { kindLabel } from '@/components/keycards/kinds';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { stateShape } from '../home/homeModel.mjs';
import { endAct } from './runMath';
import { doneLine } from '../stage';
import { endLines, endTitle, firstSentence, freeEndLines, leadView, movedParts, reviseSummary, stateKeyOf } from './runView.mjs';

const FILL = { none: 0, thin: 0.12, weak: 0.25, mid: 0.5, strong: 1, unknown: 0 };

/** The state ring, filling from the old state to the new one in 500 ms (the end's one milestone motion, A4 3.5). */
function MovedRing({ from, to }) {
  const a = FILL[stateShape(stateKeyOf(from))] ?? 0;
  const b = FILL[stateShape(stateKeyOf(to))] ?? 1;
  const c = 2 * Math.PI * 5.5;
  return (
    <svg className="lr-moved__ring" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={{ '--from': c * (1 - a), '--to': c * (1 - b) }}>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle className="lr-moved__fill" cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="11" strokeDasharray={c} transform="rotate(-90 12 12)" />
    </svg>
  );
}

function hrefOf(option, links) {
  if (!option) return null;
  if (option.href) return links.resolve ? links.resolve(option.href) : option.href;
  const run = option.run;
  if (!run) return null;
  if (run.kind === 'feed') return links.feed(run.chapterKey, run.minutes || 10);
  return links.run({ chapterKey: run.chapterKey || null, minutes: run.minutes || 10, kind: run.kind || 'mix', leaveOut: run.leaveOut || [], cardIds: run.cardIds || [] });
}

/** The pile of real card faces (A4 3.4.2): up to four, fanned; the top one shows its kind and its front. */
function RevisePile({ cards, groups }) {
  const sum = reviseSummary(groups);
  const list = (cards || []).slice(0, 4);
  if (!sum.total && !list.length) return null;
  const n = list.length;
  const mid = (n - 1) / 2;
  return (
    <section className="lr-rpile" aria-label={`${sum.total || n} in Revise from this run`}>
      {n ? (
        <ol className="lr-rpile__fan" aria-hidden="true" style={{ '--n': n }}>
          {list.map((c, i) => {
            const top = i === n - 1;
            return (
              <li key={c.id} className="lr-rpile__card" data-top={top || undefined} style={{ '--i': i, '--r': `${(i - mid) * 7}deg`, '--x': `${(i - mid) * 26}px` }}>
                {top ? (
                  <>
                    <span className="lr-rpile__kind">{kindLabel(c)}</span>
                    <span className="lr-rpile__front">{c.front}</span>
                  </>
                ) : <span className="lr-rpile__lines"><i /><i /><i /></span>}
              </li>
            );
          })}
        </ol>
      ) : null}
      <div className="lr-rpile__text">
        <p className="lr-rpile__count">{sum.total || n} in Revise</p>
        {sum.line ? <p className="lr-rpile__days">{sum.line}</p> : null}
      </div>
    </section>
  );
}

function Lead({ option, links, primary = true }) {
  const v = leadView(option);
  const href = hrefOf(option, links);
  if (!v || !href) return null;
  return (
    <div className="lr-lead">
      {v.heading ? <h2 className="lr-lead__h">{v.heading}</h2> : null}
      {v.reason && v.heading ? <p className="lr-lead__why">{v.reason}</p> : null}
      <Link className={`kc-btn ${primary ? 'kc-btn--volt' : 'kc-btn--line'} lr-lead__key`} data-page-primary={primary ? '' : undefined} href={href}>{v.key}</Link>
      {v.reason && !v.heading ? <p className="lr-lead__why">{v.reason}</p> : null}
    </div>
  );
}

function OptionRow({ option, links }) {
  const href = hrefOf(option, links);
  if (!href) return null;
  const title = option.title || option.label;
  return (
    <li>
      <Link className="lr-opt-row" href={href}>
        <span className="lr-opt-row__main">
          <span className="lr-opt-row__label">{title}</span>
          {option.evidence ? <span className="lr-opt-row__why">{option.evidence}</span> : null}
        </span>
        <ChevronRight className="lr-opt-row__chev" size={18} strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </li>
  );
}

function EndSkeleton() {
  return (
    <div className="lr-endform lr-endform--skel" aria-busy="true" aria-label="Adding up your run">
      <div className="lr-endform__left">
        <span className="skeleton lr-skel__line lr-skel__line--s" />
        <span className="skeleton lr-skel__title" />
        <span className="skeleton lr-skel__pile" />
        <span className="skeleton lr-skel__line" />
        <span className="skeleton lr-skel__line" />
      </div>
      <div className="lr-endform__right">
        <span className="skeleton lr-skel__line lr-skel__line--t" />
        <span className="skeleton lr-skel__key" />
        <span className="skeleton lr-skel__line" />
        <span className="skeleton lr-skel__line" />
      </div>
    </div>
  );
}

export default function RunEnd({ state, tally, kind = 'mix', chapter = {}, closeHref, links, onRetry, stoppedAt = null, total = null }) {
  const headRef = useRef(null);
  useEffect(() => { if (state.status === 'ready') headRef.current?.focus({ preventScroll: true }); }, [state.status]);
  if (state.status === 'loading' || state.status === 'idle') return <EndSkeleton />;
  if (state.status === 'error' || !state.data) {
    return (
      <div className="lr-state" role="alert">
        <h1 className="lr-state__title">Your run is saved</h1>
        <p>Its summary did not load. Every rating and answer is already in.</p>
        <div className="lr-state__keys">
          <button type="button" className="kc-btn kc-btn--volt" onClick={onRetry}>Try again</button>
          <Link className="kc-btn kc-btn--quiet" href={closeHref}>Back to the chapter</Link>
        </div>
      </div>
    );
  }
  const d = state.data;
  const runKind = d.kind || kind;
  const head = endTitle(d.title || chapter.title, { kind: runKind });
  // The done line (B7 E, MAIN 03:55): the server's run done when it sends one, else what this screen saw.
  const done = d.done || (total ? { reached: stoppedAt ?? total, of: total, minutes: null } : null);
  const doneText = runKind === 'recap' ? null : doneLine(done || {});
  const moved = movedParts(d.moved);
  const lines = endLines(d, { kind: runKind });
  // Mobi reacts to the result once (R6): a nod at 80 percent right or better, thinking after 3 or more missed cards.
  const act = endAct(tally);
  const free = d.lead?.go === 'pro' || (d.lead?.line && !d.lead?.run) ? freeEndLines(d.lead) : null;
  const options = (d.options || []).filter((o) => hrefOf(o, links));
  const lead = free ? options[0] || null : d.lead && hrefOf(d.lead, links) ? d.lead : null;
  const rest = (free ? options.slice(1) : options).slice(0, 3);
  const hasCards = runKind !== 'level' && runKind !== 'recap';
  const sent = reviseSummary(d.revisePile).total || (d.reviseCards || []).length;
  return (
    <section className="lr-endform" aria-labelledby="lr-end-h">
      <div className="lr-endform__left">
        <Link href={closeHref} className="lr-close lr-close--end"><X size={20} strokeWidth={2.2} aria-hidden="true" /><span className="lr-close__word">Close</span></Link>
        <div className="lr-endform__head">
          <div className="lr-endform__titles">
            <h1 className="lr-endform__title" id="lr-end-h" tabIndex={-1} ref={headRef}>
              {runKind === 'recap' && head.lead ? <span className="lr-endform__lead">{head.lead}</span> : null}
              <span className="lr-endform__name">{head.name}</span>
            </h1>
            {doneText ? <p className="lr-endform__done">{doneText}</p> : null}
          </div>
          <span className="lr-endform__mobi" aria-hidden="true"><MobiReact act={act} size={84} /></span>
        </div>
        {moved ? (
          <p className="lr-moved" aria-label={`This chapter moved from ${moved.from} to ${moved.to}.`}>
            <MovedRing from={moved.from} to={moved.to} />
            <b>{moved.to}</b>
            <span>was {moved.from}</span>
          </p>
        ) : null}
        {hasCards ? (sent ? <RevisePile cards={d.reviseCards} groups={d.revisePile} /> : <p className="lr-rpile__none">No cards went to Revise this time.</p>) : null}
        {lines.length ? (
          <dl className="lr-lines">
            {lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}
          </dl>
        ) : null}
        {d.level ? <p className="lr-endform__fine">Your lowest score was in {d.level.title}: {d.level.right} of {d.level.of} right.</p> : null}
        {d.free?.text ? <p className="lr-endform__fine">{firstSentence(d.free.text)}</p> : null}
      </div>
      <div className="lr-endform__right">
        {free ? (
          <div className="lr-free">
            <p className="lr-free__head">{free.head}</p>
            {free.rest ? <p className="lr-free__rest">{free.rest}</p> : null}
            <button type="button" className="lr-textkey" onClick={(e) => openUpgrade({ trigger: 'learn', opener: e.currentTarget })}>See Pro</button>
          </div>
        ) : null}
        {lead ? <Lead option={lead} links={links} /> : null}
        {rest.length ? <ul className="lr-opt-rows">{rest.map((o, i) => <OptionRow key={`${o.title || o.label}-${i}`} option={o} links={links} />)}</ul> : null}
        <Link className="lr-textkey lr-endform__back" href={closeHref}>Back to the chapter</Link>
      </div>
    </section>
  );
}
