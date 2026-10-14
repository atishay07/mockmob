import React from 'react';
import Link from 'next/link';
import { Surface } from '@/components/ui/Card';
import { buttonClass } from '@/components/ui/Button';
import { MemberAction } from '@/components/PublicCta';
import './public-pages.css';

// Shared parts of the public pages (web redesign W2.2): the page head, the "on this page" list and
// the closing panel with member-aware actions. Styles: ./public-pages.css (Night Sheet tokens).
// Server components; the one client piece is MemberAction in PublicCta.jsx.

/** A stable anchor id from a heading ("Choosing your five subjects" -> "choosing-your-five-subjects"). */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'section';
}

/** One anchor id per heading, in order; a repeated heading gets "-2", "-3" so ids never collide. */
export function uniqueSlugs(headings) {
  const seen = new Map();
  return headings.map((heading) => {
    const base = slugify(heading);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}

/**
 * The head of a public page: a title, one line of lead, optional actions (children).
 * No eyebrow, kicker or numbered badge. `tone` is 'moment' (large, for the pages a visitor lands
 * on) or 'read' (an article or policy: smaller, with a hairline under it). `enter` plays the page's
 * one authored settle-in once (never on a page people mostly read).
 */
export function PublicHero({ title, lead, tone = 'moment', enter = false, meta, crumbs, children, className = '' }) {
  const read = tone === 'read';
  return (
    <header className={['pp-hero', read ? 'pp-hero--read' : '', enter ? 'pp-hero--enter' : '', className].filter(Boolean).join(' ')}>
      <div className="mm-wrap">
        <div className="pp-hero__inner">
          {crumbs}
          <h1 className={`pp-title${read ? ' pp-title--headline' : ''}`}>{title}</h1>
          {lead ? <p className="pp-lead">{lead}</p> : null}
          {meta ? <p className="pp-meta">{meta}</p> : null}
          {children ? <div className="pp-actions">{children}</div> : null}
        </div>
      </div>
    </header>
  );
}

/** The "On this page" list for a long read. Desktop only; short pages and phones scroll. */
export function PageToc({ items, label = 'On this page' }) {
  if (!items?.length) return null;
  return (
    <nav className="pp-toc" aria-label={label}>
      <p className="pp-toc__title">{label}</p>
      <ol>
        {items.map((item) => (
          <li key={item.id}><a href={`#${item.id}`}>{item.label}</a></li>
        ))}
      </ol>
    </nav>
  );
}

const DEFAULT_GUEST = {
  title: 'Reading about it is not practice.',
  body: 'Create a free account and sit a timed mock on your own subjects tonight. No card, and the first drill on the home page needs no signup at all.',
};
const DEFAULT_MEMBER = {
  title: 'Put it into practice.',
  body: 'Sit a timed set on your own subjects. Your answers show what to review next.',
};

/**
 * The closing panel of a public page, the one lit surface on it. A guest sees Start free (a
 * returning visitor sees Log in first); a signed-in student sees their own action (Resume your test,
 * Start your 10-question check or Continue practice) from the navigation source. Every version is
 * rendered and <html data-visitor> picks one before first paint, so the server HTML is the same for
 * everyone and there is no flash.
 *
 * `secondary` is an optional list of { href, label, hideForPro } shown after the primary action.
 */
export function PageClose({ title = DEFAULT_GUEST.title, body = DEFAULT_GUEST.body, memberTitle = DEFAULT_MEMBER.title, memberBody = DEFAULT_MEMBER.body, secondary = [] }) {
  const extra = secondary.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className={`${buttonClass({ variant: 'secondary', size: 'lg' })}${link.hideForPro ? ' vs-hide-pro' : ''}`}
    >
      {link.label}
    </Link>
  ));
  return (
    <section className="pp-close" aria-label="Start practising">
      <div className="mm-wrap">
        <Surface level="focal" className="pp-close__panel">
          <div className="pp-close__copy vs-guest-only">
            <h2 className="pp-close__title">{title}</h2>
            <p className="pp-close__body">{body}</p>
          </div>
          <div className="pp-close__copy vs-member-only">
            <h2 className="pp-close__title">{memberTitle}</h2>
            <p className="pp-close__body">{memberBody}</p>
          </div>
          <div className="pp-close__actions">
            <Link href="/signup" className={`${buttonClass({ variant: 'primary', size: 'lg' })} vs-new-only`}>Start free</Link>
            <Link href="/login" className={`${buttonClass({ variant: 'primary', size: 'lg' })} vs-returning-only`}>Log in</Link>
            <MemberAction />
            {extra}
            <Link href="/signup" className={`${buttonClass({ variant: 'quiet', size: 'lg' })} vs-returning-only`}>Start free</Link>
          </div>
        </Surface>
      </div>
    </section>
  );
}

/** The hero actions for a page whose first action is Start free: a guest sees it, a member sees their own. */
export function HeroActions({ secondary }) {
  return (
    <>
      <Link href="/signup" className={`${buttonClass({ variant: 'primary', size: 'lg' })} vs-new-only`}>Start free</Link>
      <Link href="/login" className={`${buttonClass({ variant: 'primary', size: 'lg' })} vs-returning-only`}>Log in</Link>
      <MemberAction />
      {secondary || null}
    </>
  );
}
