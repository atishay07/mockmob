"use client";

import React, { useMemo } from 'react';
import { runnerNotice } from '@/../data/runner_notice.mjs';
import { runnerNotices } from '@/../data/notice_rules.mjs';
import { Notices } from '@/components/notices/NoticeSlot';

// The toast that overlays the test, only while the student has something to do (offline, or a submit
// waiting for a connection). It never pushes the question down: when the connection drops, nothing
// the student is reading or tapping moves. It is the shared notice slot for the test screen: the
// words come from data/notice_rules.mjs and the toast shape and its live region from NoticeSlot.
export function RunnerBanner({ state }) {
  const candidates = useMemo(() => runnerNotices(state), [state]);
  return <Notices surface="runner" candidates={candidates} />;
}

// The save state, shown beside the submit control. Quiet while everything is fine.
export function RunnerSaveState({ state }) {
  const { save } = runnerNotice(state);
  return <p className="runner-save" data-tone={save.tone}><i aria-hidden="true" />{save.text}</p>;
}
