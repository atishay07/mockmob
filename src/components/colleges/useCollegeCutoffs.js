"use client";
// Your colleges with their 2026 Round 1 cutoffs, for Today's strip and the Colleges card on You (D126, H9). The list is
// the one server list (useMyColleges); each programme's file is read once (loadOfferings caches it) and the figures come
// from src/lib/colleges/cutoffs.mjs. `status` is 'loading' until the list and every file it needs have answered, so the
// strip lands once. A programme file that fails leaves its colleges without a figure; the rest still show theirs.
import { useEffect, useMemo, useState } from 'react';
import { useMyColleges } from './useMyColleges';
import { loadOfferings } from '@/lib/du/client';
import { programmesOf, withCutoffs } from '@/lib/colleges/cutoffs.mjs';

export function useCollegeCutoffs(userId) {
  const mine = useMyColleges(userId);
  const ids = useMemo(() => (mine.status === 'ready' ? programmesOf(mine.colleges) : []), [mine.status, mine.colleges]);
  const key = ids.join('|');
  const [files, setFiles] = useState({ key: null, map: null });
  useEffect(() => {
    if (mine.status !== 'ready') return undefined;
    let alive = true;
    Promise.all(ids.map((id) => loadOfferings(id).then((f) => [id, f], () => [id, null])))
      .then((pairs) => { if (alive) setFiles({ key, map: new Map(pairs) }); });
    return () => { alive = false; };
    // `key` stands for `ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mine.status]);
  const rows = useMemo(() => (files.map && mine.status === 'ready' ? withCutoffs(mine.colleges, files.map) : null), [files.map, mine.colleges, mine.status]);
  if (!userId) return { status: 'none', rows: [], mine };
  if (mine.status === 'error') return { status: 'error', rows: [], mine };
  if (mine.status !== 'ready') return { status: 'loading', rows: [], mine };
  if (!mine.colleges.length) return { status: 'ready', rows: [], mine };
  if (files.key !== key || !rows) return { status: 'loading', rows: [], mine };
  return { status: 'ready', rows, mine };
}
