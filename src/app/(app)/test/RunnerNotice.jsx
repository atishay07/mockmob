"use client";

import React, { useMemo } from 'react';
import { runnerNotice } from '@/../data/runner_notice.mjs';
import { chooseNotice, runnerNotices } from '@/../data/notice_rules.mjs';
import { RunnerToast } from '@/components/notices/NoticeSlot';

// The toast that overlays the test, only while the student has something to do (offline, or a submit
// waiting for a connection). It never pushes the question down: when the connection drops, nothing
// the student is reading or tapping moves. It is the shared notice slot for the test screen: the
// words and the choice come from data/notice_rules.mjs and the toast shape and its live region from
// NoticeSlot. The choice is made during render, not through a provider and an effect, so the toast
// is in the same paint as the state change on the screen where timing matters most.
export function RunnerBanner({ state }) {
  const notice = useMemo(() => chooseNotice(runnerNotices(state), { surface: 'runner' }), [state]);
  return <RunnerToast notice={notice} />;
}

// The save state, shown beside the submit control. Quiet while everything is fine.
export function RunnerSaveState({ state }) {
  const { save } = runnerNotice(state);
  return <p className="runner-save" data-tone={save.tone}><i aria-hidden="true" />{save.text}</p>;
}
