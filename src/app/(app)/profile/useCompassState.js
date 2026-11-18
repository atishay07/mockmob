"use client";
// The Compass count for You's Colleges row (19 Nov 2026, lane arena-b): the same rules file and the same compassState the Colleges
// line (TodayCompass) read, so "35 of 73 open" is that line's figure, moved onto its row. A failed read draws no figure.
import { useEffect, useMemo, useState } from 'react';
import { loadRules, readSaved } from '@/lib/du/client';
import { compassState } from '@/lib/du/compassLine.mjs';

export function useCompassState(subjects) {
  const [load, setLoad] = useState({ status: 'loading', rules: null, saved: null });
  useEffect(() => {
    let alive = true;
    loadRules()
      .then((rules) => alive && setLoad({ status: 'ready', rules, saved: readSaved() }))
      .catch(() => alive && setLoad({ status: 'failed', rules: null, saved: null }));
    return () => { alive = false; };
  }, []);
  const key = (subjects || []).join(',');
  return useMemo(
    () => (load.status === 'ready' ? compassState({ rules: load.rules, saved: load.saved, profile: key ? key.split(',') : [] }) : null),
    [load, key],
  );
}
