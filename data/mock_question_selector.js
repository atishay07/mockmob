import { computeDifficultyTargets } from './test_modes.js';

export const MOCK_SELECTION_POLICY = 'latest_first_usage_aware';

export function questionCreatedTime(row) {
  const created = row?.created_at || row?.createdAt || 0;
  const time = created ? new Date(created).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function progressFor(progress, rowId) {
  return progress?.get?.(rowId) || null;
}

function legacyRankCandidates(rows, { mode, progress, weakConcepts }) {
  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  return rows
    .map((row) => {
      const seen = progressFor(progress, row.id);
      const isUnseen = !seen || (seen.attempt_count || 0) === 0;
      const isWeak = mode.useWeakTopics && row.concept_id && weakConcepts.has(row.concept_id);
      const last = seen?.last_attempted_at ? new Date(seen.last_attempted_at).getTime() : 0;
      const ageDays = last ? Math.min(400, (now - last) / dayMs) : 400;

      let priority = 0;
      if (isUnseen) priority += 10000;
      if (isWeak) priority += 5000;
      priority += ageDays;
      priority += (row.score || 0);
      return { row, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .map((entry) => entry.row);
}

export function rankCandidates(rows, { mode, progress = new Map(), weakConcepts = new Set() } = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (mode?.id === 'nta') return legacyRankCandidates(safeRows, { mode, progress, weakConcepts });

  return safeRows
    .map((row, sourceIndex) => {
      const seen = progressFor(progress, row.id);
      const attemptCount = Number(seen?.attempt_count || 0);
      const isUnseen = !seen || attemptCount === 0;
      const isWeak = Boolean(mode?.useWeakTopics && row.concept_id && weakConcepts.has(row.concept_id));
      const lastAttempted = seen?.last_attempted_at ? new Date(seen.last_attempted_at).getTime() : 0;
      return {
        row,
        sourceIndex,
        isUnseen,
        isWeak,
        attemptCount,
        lastAttempted: Number.isFinite(lastAttempted) ? lastAttempted : 0,
        createdAt: questionCreatedTime(row),
        score: Number(row.score || 0),
      };
    })
    .sort((a, b) => {
      if (a.isUnseen !== b.isUnseen) return a.isUnseen ? -1 : 1;
      if (a.isWeak !== b.isWeak) return a.isWeak ? -1 : 1;
      if (a.attemptCount !== b.attemptCount) return a.attemptCount - b.attemptCount;
      if (!a.isUnseen && a.lastAttempted !== b.lastAttempted) return a.lastAttempted - b.lastAttempted;
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      if (a.score !== b.score) return b.score - a.score;
      return a.sourceIndex - b.sourceIndex;
    })
    .map((entry) => entry.row);
}

export function pickWithConstraints(orderedRows, count, mode) {
  const targets = computeDifficultyTargets(count, mode.difficulty);
  const taken = { easy: 0, medium: 0, hard: 0 };
  const conceptCount = new Map();
  const cap = mode.maxPerConcept || 2;
  const out = [];
  const used = new Set();

  for (const row of orderedRows) {
    if (out.length >= count) break;
    const d = ['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : 'medium';
    if (taken[d] >= targets[d]) continue;
    if (cap && row.concept_id && (conceptCount.get(row.concept_id) || 0) >= cap) continue;
    out.push(row);
    used.add(row.id);
    taken[d]++;
    if (row.concept_id) conceptCount.set(row.concept_id, (conceptCount.get(row.concept_id) || 0) + 1);
  }

  if (out.length < count) {
    for (const row of orderedRows) {
      if (out.length >= count) break;
      if (used.has(row.id)) continue;
      if (cap && row.concept_id && (conceptCount.get(row.concept_id) || 0) >= cap) continue;
      out.push(row);
      used.add(row.id);
      if (row.concept_id) conceptCount.set(row.concept_id, (conceptCount.get(row.concept_id) || 0) + 1);
    }
  }

  return out.slice(0, count);
}

export function buildSelectionUsageMeta({
  selectedRows,
  candidatePool,
  progress = new Map(),
  mode,
  targetCount,
  recencyFilteredCount = 0,
} = {}) {
  const selected = Array.isArray(selectedRows) ? selectedRows : [];
  const orderedPool = (Array.isArray(candidatePool) ? candidatePool : [])
    .slice()
    .sort((a, b) => questionCreatedTime(b) - questionCreatedTime(a));
  const latestWindowSize = Math.max(selected.length, Number(targetCount) || 0);
  const latestIds = new Set(orderedPool.slice(0, latestWindowSize).map((row) => row.id));
  const oldestSelected = selected.reduce((oldest, row) => {
    const created = questionCreatedTime(row);
    if (!created) return oldest;
    return !oldest || created < oldest ? created : oldest;
  }, 0);
  const newestSelected = selected.reduce((newest, row) => Math.max(newest, questionCreatedTime(row)), 0);

  let unseenSelectedCount = 0;
  let revisitedSelectedCount = 0;
  let latestSelectedCount = 0;
  const difficultyCounts = { easy: 0, medium: 0, hard: 0, unknown: 0 };

  for (const row of selected) {
    const seen = progressFor(progress, row.id);
    if (!seen || Number(seen.attempt_count || 0) === 0) unseenSelectedCount++;
    else revisitedSelectedCount++;
    if (latestIds.has(row.id)) latestSelectedCount++;
    const difficulty = ['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : 'unknown';
    difficultyCounts[difficulty]++;
  }

  return {
    policy: MOCK_SELECTION_POLICY,
    mode: mode?.id || 'quick',
    targetCount: Number(targetCount) || selected.length,
    selectedCount: selected.length,
    latestWindowSize,
    latestSelectedCount,
    olderFallbackSelectedCount: Math.max(0, selected.length - latestSelectedCount),
    unseenSelectedCount,
    revisitedSelectedCount,
    recencyFilteredCount,
    difficultyCounts,
    newestSelectedAt: newestSelected ? new Date(newestSelected).toISOString() : null,
    oldestSelectedAt: oldestSelected ? new Date(oldestSelected).toISOString() : null,
  };
}
