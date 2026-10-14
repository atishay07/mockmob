"use client";

import React, { useContext, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { chooseNotice, placementFor, slotShows } from '@/../data/notice_rules.mjs';
import { NoticeBoundary, NoticeContext, useNoticeSource } from './NoticeProvider';
import './notices.css';
import '@/app/(app)/test/runner-notice.css';

// One slot per surface, one notice in it. The status region stays in the page and only its content
// comes and goes: a status region inserted already filled is often not announced, and this is how a
// screen-reader user learns that something changed.
//
// runner  A toast over the timed test. Taps pass through it, it never pushes a question down, and it
//         cannot be dismissed. Reuses runner-sync-state so both test interfaces keep their colours.
// others  An inline row with the reason, an optional action and, where the notice allows it, a
//         dismiss button.
export function NoticeSlot({ surface }) {
  const ctx = useContext(NoticeContext);
  const pathname = usePathname();
  const show = slotShows(surface, pathname);
  const notice = ctx && show
    ? chooseNotice(ctx.candidates, { surface, dismissed: ctx.dismissed, visitor: ctx.visitor, dismissalsReady: ctx.ready })
    : null;

  if (placementFor(surface) === 'toast') {
    return (
      <div role="status" className="runner-notice">
        {notice ? <div className="runner-sync-state runner-sync-state--warn">{notice.text}</div> : null}
      </div>
    );
  }
  return (
    <div role="status" className="notice-slot">
      {notice ? <InlineNotice key={`${notice.id}:${notice.stateKey}`} notice={notice} onDismiss={ctx.dismiss} /> : null}
    </div>
  );
}

function InlineNotice({ notice, onDismiss }) {
  const [why, setWhy] = useState(false);
  const whyId = useId();
  return (
    <div className="notice" data-tone={notice.tone}>
      <p className="notice__text">{notice.text}</p>
      <div className="notice__actions">
        {notice.action ? <Link className="notice__action" href={notice.action.href}>{notice.action.label}</Link> : null}
        <button type="button" className="notice__why-toggle" aria-expanded={why} aria-controls={whyId} onClick={() => setWhy((open) => !open)}>
          Why am I seeing this?
        </button>
        {notice.dismissible ? (
          <button type="button" className="notice__dismiss" aria-label="Dismiss this notice" onClick={() => onDismiss(notice)}>
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p id={whyId} className="notice__why" hidden={!why}>{notice.why}</p>
    </div>
  );
}

function Publisher({ source, candidates }) {
  useNoticeSource(source, candidates);
  return null;
}

/** A surface's slot with its own source of notices: the usual way to put one on a page. */
export function Notices({ surface, source = surface, candidates }) {
  return (
    <NoticeBoundary>
      <Publisher source={source} candidates={candidates} />
      <NoticeSlot surface={surface} />
    </NoticeBoundary>
  );
}
