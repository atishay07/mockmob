"use client";

import React, { useCallback, useContext, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { chooseNotice, placementFor, slotShows } from '@/../data/notice_rules.mjs';
import { NoticeBoundary, NoticeContext, useNoticeSource } from './NoticeProvider';
import './notices.css';
import './runner-notice.css';

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
  const slotRef = useRef(null);
  const dismiss = ctx?.dismiss;
  // The dismiss button unmounts when it is pressed, which would drop a keyboard user on <body>.
  // Focus goes to the slot, where they were on the page, so Tab carries on from there. An empty slot
  // shows a focus line while it holds focus (notices.css), so they can see where they are.
  const onDismiss = useCallback((notice) => {
    dismiss?.(notice);
    slotRef.current?.focus();
  }, [dismiss]);
  const pathname = usePathname();
  const show = slotShows(surface, pathname);
  const notice = ctx && show
    ? chooseNotice(ctx.candidates, { surface, dismissed: ctx.dismissed, visitor: ctx.visitor, dismissalsReady: ctx.ready })
    : null;

  if (placementFor(surface) === 'toast') return <RunnerToast notice={notice} />;
  // The slot is the row when a notice is showing. Only the text sits inside the live region: the
  // controls stay outside it, so a screen reader does not read them out each time a notice changes.
  return (
    <div className="notice-slot" tabIndex={-1} ref={slotRef} data-tone={notice ? notice.tone : undefined}>
      <div role="status" className="notice__live">
        {notice ? <p className="notice__text">{notice.text}</p> : null}
      </div>
      {notice ? <NoticeControls key={`${notice.id}:${notice.stateKey}`} notice={notice} onDismiss={onDismiss} /> : null}
    </div>
  );
}

/**
 * The toast over the timed test. It takes the chosen notice as a prop so the test screen can choose
 * during render, with no provider and no effect between a state change and the toast: when the
 * connection drops, the toast is in the same paint.
 */
export function RunnerToast({ notice }) {
  return (
    <div role="status" className="runner-notice">
      {notice ? <div className="runner-sync-state runner-sync-state--warn">{notice.text}</div> : null}
    </div>
  );
}

function NoticeControls({ notice, onDismiss }) {
  const [why, setWhy] = useState(false);
  const whyId = useId();
  return (
    <>
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
    </>
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
