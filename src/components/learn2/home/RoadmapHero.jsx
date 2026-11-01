'use client';
// Learn home's one start offer (R2 ruling 1, LK27): the headline, one line, the page's one volt key, and at most two quiet "Or"
// rows. Every word comes from the server's `roadmap` (data/learn/roadmap.js); nothing is made up here and no zero is ever drawn.
// Under the line, the route: one node per chapter of the student's roadmap, the chapters seen once filled, the one the student is
// in ringed in volt. The nodes fill left to right once on arrival (24 ms apart, 180 ms each) and the current one swells once
// (400 ms); reduced motion draws them at once. Tapping the route scrolls to "Your roadmap".
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { openUpgrade } from '@/components/pro';
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

/** The route: one node per chapter in book order. `rows` are the roadmap rows ({ key, title, progress }). */
function Route({ rows, current, onGo }) {
  if (!rows || rows.length < 2) return null;
  const at = rows.findIndex((r) => r.key === current);
  const label = at >= 0 ? `Your roadmap: chapter ${at + 1} of ${rows.length}. Show the chapters` : 'Show your roadmap';
  return (
    <button type="button" className="lh-route" onClick={onGo} aria-label={label}>
      {rows.map((r, i) => {
        const p = r.progress || {};
        const of = Number(p.of) || 0;
        const seen = Number(p.seen) || 0;
        const state = r.key === current ? 'here' : of > 0 && seen >= of ? 'done' : seen > 0 || Number(p.tried) > 0 ? 'some' : 'none';
        return <span key={r.key} className="lh-route__node" data-state={state} style={{ '--i': i }} aria-hidden="true" />;
      })}
    </button>
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

export default function RoadmapHero({ roadmap, links, rows = [], onRoute }) {
  if (!roadmap) return null;
  const { mode, headline, line, sub, progress, key, quiet } = roadmap;
  const or = (roadmap.or || []).slice(0, 2);
  const keyHref = key?.go === 'pro' ? null : actionHref(key, links);
  const quietHref = actionHref(quiet, links);
  return (
    <section className="lh-hero" data-mode={mode} aria-labelledby="lh-hero-title">
      <h2 className="lh-hero__title" id="lh-hero-title">{displayTitle(headline)}</h2>
      {line ? <p className="lh-hero__line">{displayTitle(line)}</p> : null}
      {progress ? <Track progress={progress} /> : null}
      {mode !== 'pickup' && mode !== 'freeDone' ? <Route rows={rows} current={roadmap.position?.chapterKey} onGo={onRoute} /> : null}
      {sub ? <p className="lh-hero__sub">{sub}</p> : null}
      <div className="lh-hero__keys">
        {key?.go === 'pro'
          ? <button type="button" className="lh-key lh-key--volt lh-hero__key" data-page-primary="" onClick={(e) => openUpgrade({ trigger: 'learn_home', opener: e.currentTarget })}>{key.label}</button>
          : keyHref ? <Link className="lh-key lh-key--volt lh-hero__key" data-page-primary="" href={keyHref}>{key.label}</Link> : null}
        {quiet && quietHref ? <Link className="lh-hero__quiet" href={quietHref}>{quiet.label}</Link> : null}
      </div>
      {or.length ? (
        <ul className="lh-or" aria-label="Or">
          {or.map((o) => {
            const href = actionHref(o, links);
            if (!href) return null;
            return (
              <li key={o.kind}>
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
