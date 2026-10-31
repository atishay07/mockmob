'use client';
// Learn home's suggestions (A3 3.2.4): three, of different kinds, each with one line of evidence. The first leads, larger, with
// the page's one volt key; the other two keep an outlined key. No kind word above the title (the engine's own `headline` is set in
// bold inside it), no subject object (the subject row above already shows it), no minimum height: a tile is as tall as what it says,
// and on a wide screen the tiles share rows (CSS subgrid) so titles, lines and keys align across them. Every key starts at once: it
// is a link to the run (or the suggestion's own destination), with no pre-fill step in between.
import Link from 'next/link';
import { homeSuggestions, pickupProgress, shortAction, splitTitle, displayTitle, suggestionTarget } from './homeModel.mjs';

/** Where a server href goes. In the development preview a real route is mapped to the preview's own view of it. */
export function resolveHref(href, links) {
  if (!href) return href;
  return typeof links?.resolve === 'function' ? links.resolve(href) : href;
}

/** An unfinished run carries its id, so the key picks it up where it stopped. */
const withResume = (href, resume) => (resume ? `${href}${href.includes('?') ? '&' : '?'}resume=${encodeURIComponent(resume)}` : href);

/** The pick-up tile's thin track: only steps that are done (the real "6 of 16"), filled once per visit. */
function Track({ progress }) {
  const pct = Math.round((progress.done / progress.of) * 1000) / 10;
  return (
    <span className="lh-track" role="img" aria-label={`${progress.done} of ${progress.of} done`}>
      <span className="lh-track__fill" style={{ '--p': `${pct}%` }} />
    </span>
  );
}

function Suggestion({ suggestion, lead, links, index }) {
  const target = suggestionTarget(suggestion);
  const href = !target ? null : target.type === 'run'
    ? withResume(links.run({ chapterKey: target.run.chapterKey, minutes: target.run.minutes, kind: target.run.kind, leaveOut: target.run.leaveOut || [], cardIds: target.run.cardIds || [] }), target.run.resume)
    : resolveHref(target.href, links);
  const { headline, rest } = splitTitle(suggestion);
  const progress = lead ? pickupProgress(suggestion) : null;
  const whyId = `lh-why-${index}`;
  return (
    <article className="lh-sug" data-lead={lead || undefined} data-kind={suggestion.kind} style={{ '--i': index }}>
      <div className="lh-sug__text">
        <h3 className="lh-sug__title">
          {!lead && headline ? <><b>{displayTitle(headline)}</b>{displayTitle(rest)}</> : displayTitle(suggestion.title)}
        </h3>
        <div className="lh-sug__ev">
          <p className="lh-sug__why" id={whyId}>{suggestion.evidence}</p>
          {progress ? <Track progress={progress} /> : null}
        </div>
      </div>
      {href ? (
        <Link className={`lh-key ${lead ? 'lh-key--volt' : 'lh-key--line'}`} data-page-primary={lead ? '' : undefined} href={href} aria-describedby={whyId}>
          <span className="lh-key__full">{suggestion.action.label}</span>
          <span className="lh-key__short" aria-hidden="true">{shortAction(suggestion.action.label)}</span>
        </Link>
      ) : null}
    </article>
  );
}

/** The tiles before the data, at the heights they will have (a lead of about 180 px, compact rows of 84), so nothing moves. */
export function SuggestionsSkeleton() {
  return (
    <div className="lh-sugs lh-sugs--skel" aria-hidden="true">
      <div className="lh-sug" data-lead><span className="skeleton lh-sk lh-sk--t" /><span className="skeleton lh-sk lh-sk--l" /><span className="skeleton lh-sk lh-sk--key" /></div>
      <div className="lh-sug"><span className="skeleton lh-sk lh-sk--t" /><span className="skeleton lh-sk lh-sk--l" /><span className="skeleton lh-sk lh-sk--key" /></div>
      <div className="lh-sug"><span className="skeleton lh-sk lh-sk--t" /><span className="skeleton lh-sk lh-sk--l" /><span className="skeleton lh-sk lh-sk--key" /></div>
    </div>
  );
}

export default function Suggestions({ suggestions, links }) {
  const list = homeSuggestions(suggestions);
  if (!list.length) return null;
  return (
    <section className="lh-sugs" data-count={list.length} aria-label="Where to start">
      {list.map((s, i) => <Suggestion key={`${s.kind}-${i}`} suggestion={s} lead={i === 0} links={links} index={i} />)}
    </section>
  );
}
