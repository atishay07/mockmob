'use client';
// Learn home's one start offer (R2 ruling 1, LK27): the headline, one line, the page's one volt key, and at most two quiet "Or"
// rows. Every word comes from the server's `roadmap` (data/learn/roadmap.js); nothing is made up here and no zero is ever drawn.
// R3 ruling R2: under the headline stays "Chapter 1 of 14 · <chapter>"; the row of ring dots is gone (the roadmap below is the route).
// R3 ruling R3: the Or rows are at most two, in the server's order (Revise N due cards, the open mistakes, Skip what you already
// know, the feed); on Free after the day's session the block is the feed refusal's: headline, line, See Pro, Continue, Revise, singles.
import { useCallback, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { openUpgrade } from '@/components/pro';
import { LengthControl, OwnSheet } from '../LengthPicker';
import { displayTitle } from './homeModel.mjs';

/** A server action ({ run } | { href, go }) as a link for where the student is (the preview keeps its own views). */
export function actionHref(action, links) {
  if (!action) return null;
  if (action.run) {
    const r = action.run;
    const href = links.run({ chapterKey: r.chapterKey, minutes: r.minutes, kind: r.kind, leaveOut: r.leaveOut || [], cardIds: r.cardIds || [] });
    return r.resume ? `${href}${href.includes('?') ? '&' : '?'}resume=${encodeURIComponent(r.resume)}` : href;
  }
  if (action.go === 'explore') return links.explore();
  return typeof links.resolve === 'function' ? links.resolve(action.href) : action.href;
}

function Track({ progress }) {
  const pct = Math.round((progress.done / progress.of) * 1000) / 10;
  return (
    <span className="lh-track lh-hero__track" role="img" aria-label={`${progress.done} of ${progress.of} done`}>
      <span className="lh-track__fill" style={{ '--p': `${pct}%` }} />
    </span>
  );
}

/** The offer's place before the data, at its final height (title, line, key), so nothing moves when it lands. */
export function HeroSkeleton() {
  return (
    <div className="lh-hero lh-hero--skel" aria-hidden="true">
      <span className="skeleton lh-sk lh-sk--t" />
      <span className="skeleton lh-sk lh-sk--l" />
      <span className="skeleton lh-sk lh-sk--key" />
    </div>
  );
}

/**
 * LK37: the offer's length is the student's to change in place, as on the chapter page: 5 | 10 | 20 | Other ("Other" opens the own-length
 * sheet). It shows the length the student chose; the headline, the due cards and the key follow from the server's answer for it. Only
 * a new offer has a length (a run to pick up carries its own minutes), and on Free the server's one line says the 10-minute cap.
 */
function OfferLength({ chosen, onChange, capped }) {
  const labelId = useId();
  const wrap = useRef(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const closeOwn = useCallback(() => {
    setOwnOpen(false);
    requestAnimationFrame(() => wrap.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }));
  }, []);
  const choose = (m) => { closeOwn(); if (m !== chosen) onChange(m); };
  return (
    <div className="lh-hero__len">
      <span className="lh-sr" id={labelId}>How long have you got?</span>
      <LengthControl minutes={chosen} onChange={choose} onOwn={() => setOwnOpen(true)} labelledBy={labelId} wrapRef={wrap} />
      <OwnSheet key={ownOpen ? 'open' : 'shut'} open={ownOpen} minutes={chosen} onChoose={choose} onClose={closeOwn} anchorRef={wrap} />
      {capped?.text ? <p className="lh-hero__cap">{capped.text}</p> : null}
    </div>
  );
}

export default function RoadmapHero({ roadmap, links, minutes = null, onMinutes = null, pending = false }) {
  if (!roadmap) return null;
  const { mode, headline, line, sub, progress, key, quiet, capped } = roadmap;
  const adjustable = typeof onMinutes === 'function' && (mode === 'today' || mode === 'new') && Number(roadmap.minutes) > 0;
  const or = (roadmap.or || []).slice(0, 2);
  const keyHref = key?.go === 'pro' ? null : actionHref(key, links);
  const quietHref = actionHref(quiet, links);
  return (
    <section className="lh-hero" data-mode={mode} aria-labelledby="lh-hero-title">
      <h2 className="lh-hero__title" id="lh-hero-title">{displayTitle(headline)}</h2>
      {line ? <p className="lh-hero__line">{displayTitle(line)}</p> : null}
      {progress ? <Track progress={progress} /> : null}
      {sub ? <p className="lh-hero__sub">{sub}</p> : null}
      {adjustable ? <OfferLength chosen={minutes || Number(roadmap.asked) || Number(roadmap.minutes)} onChange={onMinutes} capped={capped} /> : null}
      <div className="lh-hero__keys">
        {key?.go === 'pro'
          ? <button type="button" className="lh-key lh-key--volt lh-hero__key" data-page-primary="" onClick={(e) => openUpgrade({ trigger: 'learn_home', opener: e.currentTarget })}>{key.label}</button>
          : keyHref ? <Link className="lh-key lh-key--volt lh-hero__key" data-page-primary="" href={keyHref} aria-disabled={pending || undefined} onClick={(e) => { if (pending) e.preventDefault(); }}>{key.label}</Link> : null}
        {quiet && quietHref ? <Link className="lh-hero__quiet" href={quietHref}>{quiet.label}</Link> : null}
      </div>
      {or.length ? (
        <ul className="lh-or" aria-label="Or">
          {or.map((o) => {
            const href = actionHref(o, links);
            if (!href) return null;
            return (
              <li key={o.kind} data-kind={o.kind}>
                <Link className="lh-or__row" href={href}>
                  <span className="lh-or__text"><b>{o.label}</b>{o.line ? <span>{displayTitle(o.line)}</span> : null}</span>
                  <ChevronRight className="lh-or__chev" size={18} strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
