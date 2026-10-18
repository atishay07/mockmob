// The reel's script from what a paper holds (owner D29). PURE. One path, so the result page and Today build the same reel
// from the same record: the sheet, the real moments, the costliest chapter and the one next move.
import { reelScript, replayView } from '../../../data/replay.js';

/**
 * The plain values a script reads, taken from the result's own objects (`analysis` from analyseSession, `attempt`, `timeRead`,
 * `finding` from costliestLine, `move` from nextMove). Flat on purpose: a caller that rebuilds those objects on every render
 * can still key a memo on these values.
 */
export function reelInputs({ analysis = null, attempt = null, timeRead = null, finding = null, move = null } = {}) {
  return {
    rows: analysis?.rows,
    replay: attempt?.lab?.replay || null,
    paceMs: timeRead?.pace?.perQuestionMs || null,
    rec: attempt?.selectionMeta?.recovery || null,
    kind: move?.kind || null,
    label: move?.label || null,
    target: move?.target || null,
    line: finding?.line || null,
    detail: finding?.detail || null,
    chapter: finding?.chapter || null,
  };
}

/** The script from `reelInputs`, or null when there is nothing to play back (no rows, or nothing answered). */
export function buildReelScript({ rows, replay = null, paceMs = null, rec = null, kind = null, label = null, target = null, line = null, detail = null, chapter = null } = {}) {
  if (!rows?.length) return null;
  const view = replay ? replayView(replay, { total: rows.length }) : null;
  const paceSec = paceMs ? paceMs / 1000 : replay?.durationSec ? replay.durationSec / rows.length : null;
  const changes = rec?.telemetry === 'self_reported' && Array.isArray(rec.observed?.answerChanges) ? rec.observed.answerChanges : [];
  return reelScript({
    rows, changes, view, paceSec,
    finding: line ? { line, detail, chapter } : null,
    next: label ? { kind, label, target, href: (kind === 'practise' || kind === 'harder') && target?.href ? target.href : null } : null,
  });
}

/** Both steps at once, for a caller that holds the result's objects only once (Today). */
export const reelScriptOf = (parts) => buildReelScript(reelInputs(parts));
