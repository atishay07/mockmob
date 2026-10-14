"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AuthContext } from '@/components/AuthProvider';
import { visitorState } from '@/../data/visitor_state.mjs';
import {
  NOTICE_STORAGE_KEY,
  dismissNotice,
  parseDismissed,
  reconcileDismissed,
  writeDismissed,
} from '@/../data/notice_rules.mjs';

// Dismissals live in localStorage, per device. Storage can be blocked, throw, or come back empty
// (private window, cleared site data), so every access is guarded and a failed write falls back to
// memory for this page visit: the notice stays dismissed until the person leaves, then returns.
let memoryRaw = null;
const listeners = new Set();

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw() {
  if (memoryRaw !== null) return memoryRaw;
  try {
    return storage()?.getItem(NOTICE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeMap(map) {
  const ok = writeDismissed(storage(), map);
  memoryRaw = ok ? null : JSON.stringify(parseDismissed(map));
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (event) => {
    if (event.key === NOTICE_STORAGE_KEY || event.key === null) fn();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

const noopSubscribe = () => () => {};

export const NoticeContext = createContext(null);

/**
 * Holds the notices every part of the page has offered and the dismissals read from this device.
 * Slots choose from it; sources publish into it. Mount once near the top of a surface. Surfaces
 * that find no provider above them create their own through NoticeBoundary.
 */
export function NoticeProvider({ children }) {
  const auth = useContext(AuthContext);
  const [sources, setSources] = useState({});
  const raw = useSyncExternalStore(subscribe, readRaw, () => '');
  // False on the server and during hydration, true afterwards: dismissible notices wait for it.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const dismissed = useMemo(() => parseDismissed(raw), [raw]);

  const publish = useCallback((source, list) => {
    setSources((prev) => ({ ...prev, [source]: Array.isArray(list) ? list : [] }));
  }, []);
  const clear = useCallback((source) => {
    setSources((prev) => {
      if (!(source in prev)) return prev;
      const next = { ...prev };
      delete next[source];
      return next;
    });
  }, []);
  const dismiss = useCallback((notice) => {
    writeMap(dismissNotice(parseDismissed(readRaw()), notice));
  }, []);
  const forget = useCallback((evaluatedIds, activeIds) => {
    const current = parseDismissed(readRaw());
    const next = reconcileDismissed(current, evaluatedIds, activeIds);
    if (next !== current) writeMap(next);
  }, []);

  const visitor = useMemo(
    () => visitorState({ status: auth?.status || 'loading', user: auth?.user || null, hint: null }),
    [auth?.status, auth?.user],
  );
  const candidates = useMemo(() => Object.values(sources).flat(), [sources]);

  const value = useMemo(
    () => ({ candidates, dismissed, ready, visitor, publish, clear, dismiss, forget }),
    [candidates, dismissed, ready, visitor, publish, clear, dismiss, forget],
  );
  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

/** Uses the provider above when there is one, so a surface never ends up with two sets of notices. */
export function NoticeBoundary({ children }) {
  const parent = useContext(NoticeContext);
  return parent ? children : <NoticeProvider>{children}</NoticeProvider>;
}

/**
 * Offers notices to the nearest provider while this component is mounted. `source` names who is
 * offering, so one source replaces its own earlier list and never touches another's.
 */
export function useNoticeSource(source, candidates) {
  const ctx = useContext(NoticeContext);
  const publish = ctx?.publish;
  const clear = ctx?.clear;
  const signature = JSON.stringify(candidates || []);
  useEffect(() => {
    if (!publish) return undefined;
    publish(source, JSON.parse(signature));
    return () => clear(source);
  }, [publish, clear, source, signature]);
}

/** For sources that know when a state has ended: forget a dismissal so the notice can return. */
export function useNoticeForget() {
  return useContext(NoticeContext)?.forget;
}
