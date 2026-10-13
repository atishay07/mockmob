"use client";

import React from 'react';
import { runnerNotice } from '@/../data/runner_notice.mjs';
import './runner-notice.css';

// A strip across the top, only while the student has something to do (offline, or a submit
// waiting for a connection). Reuses runner-sync-state so both interfaces keep their colours.
export function RunnerBanner({ state }) {
  const { banner } = runnerNotice(state);
  // The live region stays in the page and only its content comes and goes. A status region that
  // is inserted already filled is often not announced, and this is how a screen-reader user
  // learns that the connection dropped or that a submit is waiting.
  return (
    <div role="status">
      {banner ? <div className="runner-sync-state runner-sync-state--warn">{banner.text}</div> : null}
    </div>
  );
}

// The save state, shown beside the submit control. Quiet while everything is fine.
export function RunnerSaveState({ state }) {
  const { save } = runnerNotice(state);
  return <p className="runner-save" data-tone={save.tone}><i aria-hidden="true" />{save.text}</p>;
}
