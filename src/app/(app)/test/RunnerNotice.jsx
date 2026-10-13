"use client";

import React from 'react';
import { runnerNotice } from '@/../data/runner_notice.mjs';
import './runner-notice.css';

// A strip across the top, only while the student has something to do (offline, or a submit
// waiting for a connection). Reuses runner-sync-state so both interfaces keep their colours.
export function RunnerBanner({ state }) {
  const { banner } = runnerNotice(state);
  if (!banner) return null;
  return <div role="status" className="runner-sync-state runner-sync-state--warn">{banner.text}</div>;
}

// The save state, shown beside the submit control. Quiet while everything is fine.
export function RunnerSaveState({ state }) {
  const { save } = runnerNotice(state);
  return <p className="runner-save" data-tone={save.tone}><i aria-hidden="true" />{save.text}</p>;
}
