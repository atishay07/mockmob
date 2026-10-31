'use client';
// Learn home's three suggestions (DESIGN-SPEC A7): always three, of three different kinds, each with its one line of evidence.
// The first leads, larger, with the lamp-lit subject object and the page's one volt key; the other two are smaller and keep an outlined key
// (on a phone they are two compact rows under the lead, each with a short key). Every key starts at
// once: it is a link to the run (or to the suggestion's own destination), with no pre-fill step in between.
import Link from 'next/link';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { kindWord, shortAction, suggestionTarget } from './homeModel.mjs';

/** Where a server href goes. In the development preview a real route is mapped to the preview's own view of it. */
export function resolveHref(href, links, subject) {
  if (!links.preview || !href || href.startsWith('/preview/')) return href;
  let url;
  try { url = new URL(href, 'http://x'); } catch { return href; }
  const path = url.pathname;
  const get = (k) => url.searchParams.get(k);
  if (path === '/learn/find') return links.find(get('subject') || subject, get('q'));
  const cards = path.match(/^\/learn\/c\/([^/]+)\/cards$/);
  if (cards) return links.cards(decodeURIComponent(cards[1]), get('f'));
  const chapter = path.match(/^\/learn\/c\/([^/]+)$/);
  if (chapter) return links.chapter(decodeURIComponent(chapter[1]), get('min'));
  if (path === '/learn') return links.home(get('subject') || subject);
  return href;
}

/** An unfinished run carries its id, so the key picks it up where it stopped. */
const withResume = (href, resume) => (resume ? `${href}${href.includes('?') ? '&' : '?'}resume=${encodeURIComponent(resume)}` : href);

function Suggestion({ suggestion, lead, links, subject, index }) {
  const target = suggestionTarget(suggestion);
  const href = !target ? null : target.type === 'run' ? withResume(links.run({ chapterKey: target.run.chapterKey, minutes: target.run.minutes, kind: target.run.kind, leaveOut: target.run.leaveOut || [] }), target.run.resume) : resolveHref(target.href, links, subject);
  // The word above the title is dropped when the title already opens with it ("Pick up" over "Pick up Admission of a Partner").
  const word = kindWord(suggestion.kind);
  const kindLine = word && !String(suggestion.title || '').toLowerCase().startsWith(word.toLowerCase()) ? word : '';
  return (
    <article className="lh-sug" data-lead={lead || undefined} data-kind={suggestion.kind} style={{ '--i': index }}>
      {lead ? <SubjectObject id={subject} size={96} lit life={false} className="lh-sug__obj" /> : null}
      {kindLine ? <p className="lh-sug__kind">{kindLine}</p> : null}
      <h3 className="lh-sug__title">{suggestion.title}</h3>
      <p className="lh-sug__why">{suggestion.evidence}</p>
      {href ? (
        <Link className={`lh-key ${lead ? 'lh-key--volt' : 'lh-key--line'}`} href={href}>
          <span className="lh-key__full">{suggestion.action.label}</span>
          <span className="lh-key__short" aria-hidden="true">{shortAction(suggestion.action.label)}</span>
        </Link>
      ) : null}
    </article>
  );
}

export function SuggestionsSkeleton() {
  return (
    <div className="lh-sugs" aria-hidden="true">
      <div className="lh-sug lh-sug--skel" data-lead><span className="skeleton lh-sk lh-sk--t" /><span className="skeleton lh-sk lh-sk--l" /><span className="skeleton lh-sk lh-sk--key" /></div>
      <div className="lh-sug lh-sug--skel"><span className="skeleton lh-sk lh-sk--t" /><span className="skeleton lh-sk lh-sk--l" /><span className="skeleton lh-sk lh-sk--key" /></div>
      <div className="lh-sug lh-sug--skel"><span className="skeleton lh-sk lh-sk--t" /><span className="skeleton lh-sk lh-sk--l" /><span className="skeleton lh-sk lh-sk--key" /></div>
    </div>
  );
}

export default function Suggestions({ suggestions, links, subject }) {
  if (!suggestions?.length) return null;
  return (
    <section className="lh-sugs" aria-label="Where to start">
      {suggestions.map((s, i) => <Suggestion key={`${s.kind}-${i}`} suggestion={s} lead={i === 0} links={links} subject={subject} index={i} />)}
    </section>
  );
}
